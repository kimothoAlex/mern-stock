import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { app } from "../fierbase";
import { useEffect, useState } from "react";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Alert, Button, FileInput, Label, Select, TextInput } from "flowbite-react";
import { enqueueSnackbar } from "notistack";

const DEFAULT_CATEGORIES = [
  "Grocery",
  "Drinks",
  "Snacks",
  "Dairy",
  "Bakery",
  "Meat",
  "Fruits & Vegetables",
  "Cleaning",
  "Personal Care",
  "Stationery",
  "Electronics",
  "Hardware",
  "Other",
];

const PRODUCT_TYPES = [
  "general",
  "grocery",
  "electronics",
  "clothing",
  "service",
  "other",
];

const UpdateProduct = () => {
  const [file, setFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(null);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [imageFileUrl, setImageFileUrl] = useState(null);

  const [formData, setFormData] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  const { productId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/product/getproducts?productId=${productId}`);
        const data = await res.json();

        if (!res.ok) {
          setUpdateError(data.message || "Failed to load product");
          return;
        }

        const product = data.products?.[0];
        if (!product) {
          setUpdateError("Product not found");
          return;
        }

        setUpdateError(null);

        // Normalize for inputs + ensure required fields exist
        setFormData({
          _id: product._id,
          slug: product.slug,
          name: product.name || "",
          barcode: product.barcode || "",
          category: product.category || "",
          type: product.type || "general",
          price: product.price ?? "",
          quantity: product.quantity ?? "",
          imageUrl: product.imageUrl || "",
        });
      } catch (err) {
        setUpdateError(err.message || "Failed to load product");
      }
    };

    fetchProduct();
  }, [productId]);

  const handleUpdloadImage = async () => {
    try {
      if (!file) {
        setImageUploadError("Please select an image");
        return;
      }
      setImageUploadError(null);
      setImageUploading(true);

      const storage = getStorage(app);
      const fileName = new Date().getTime() + "-" + file.name;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setImageUploadProgress(progress.toFixed(0));
        },
        () => {
          setImageUploadError("Image upload failed");
          setImageUploadProgress(null);
          setImageUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setImageFileUrl(downloadURL);
            setImageUploadProgress(null);
            setImageUploadError(null);
            setFormData((prev) => ({ ...prev, imageUrl: downloadURL }));
            setImageUploading(false);
          });
        }
      );
    } catch (error) {
      setImageUploadError("Image upload failed");
      setImageUploadProgress(null);
      setImageUploading(false);
      console.log(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData) return;

    if (imageUploading) {
      setImageUploadError("Please wait for image to upload");
      return;
    }

    try {
      setUpdateError(null);

      // Basic validation (matches your backend fields)
      if (!formData.name.trim()) return setUpdateError("Name is required");
      if (!formData.type.trim()) return setUpdateError("Type is required");
      if (!formData.category.trim()) return setUpdateError("Category is required");
      if (formData.price === "" || Number(formData.price) < 0) return setUpdateError("Valid price is required");
      if (formData.quantity === "" || Number(formData.quantity) < 0) return setUpdateError("Valid quantity is required");
      if (!formData.barcode.trim()) return setUpdateError("Barcode is required (your backend enforces this)");

      // IMPORTANT: send ONLY fields your controller updates
      const payload = {
        name: formData.name.trim(),
        type: formData.type.trim(),
        category: formData.category.trim(),
        price: Number(formData.price),
        quantity: Number(formData.quantity),
        imageUrl: formData.imageUrl || "",
        barcode: formData.barcode.trim(),
      };

      const res = await fetch(`/api/product/update/${formData._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setUpdateError(data.message || "Failed to update product");
        return;
      }

      enqueueSnackbar("Product Updated!", { variant: "success" });
      navigate(`/product/${data.slug}`);
    } catch (error) {
      setUpdateError("Something went wrong");
    }
  };

  if (!formData) {
    return (
      <div className="p-3 max-w-3xl mx-auto min-h-screen">
        <Alert color="info">Loading product...</Alert>
        {updateError && <Alert color="failure" className="mt-4">{updateError}</Alert>}
      </div>
    );
  }

  return (
    <div className="p-3 max-w-3xl mx-auto min-h-screen">
      <div className="flex items-center justify-between my-7">
        <h1 className="text-3xl font-semibold">Update Product</h1>
        <Link to="/barcode" className="text-sm font-semibold text-teal-600 hover:underline">
          Scan / Find Barcode
        </Link>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* Name + Category */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Label value="Product Name" />
            <TextInput
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <Label value="Category" />
              <button
                type="button"
                className="text-xs text-teal-600 hover:underline"
                onClick={() => setUseCustomCategory((v) => !v)}
              >
                {useCustomCategory ? "Use dropdown" : "Custom category"}
              </button>
            </div>

            {!useCustomCategory ? (
              <Select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                required
              >
                <option value="">Select category</option>
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            ) : (
              <TextInput
                type="text"
                placeholder="e.g., Farm inputs"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                required
              />
            )}
          </div>
        </div>

        {/* Barcode + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label value="Barcode (required)" />
            <TextInput
              type="text"
              placeholder="Scan or type barcode"
              required
              value={formData.barcode}
              onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
            />
          </div>

          <div>
            <Label value="Type" />
            <Select
              value={formData.type}
              onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
              required
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Price + Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label value="Selling Price" />
            <TextInput
              type="number"
              min="0"
              required
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
            />
          </div>

          <div>
            <Label value="Stock Quantity" />
            <TextInput
              type="number"
              min="0"
              required
              value={formData.quantity}
              onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
            />
          </div>
        </div>

        {/* Image */}
        <div className="flex gap-4 items-center justify-between border-4 border-teal-500 border-dotted p-3">
          <FileInput type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <Button
            type="button"
            gradientDuoTone="purpleToBlue"
            size="sm"
            outline
            onClick={handleUpdloadImage}
            disabled={imageUploadProgress}
          >
            {imageUploadProgress ? (
              <div className="w-16 h-16">
                <CircularProgressbar value={imageUploadProgress} text={`${imageUploadProgress || 0}%`} />
              </div>
            ) : (
              "Upload Image"
            )}
          </Button>
        </div>

        {imageUploadError && <Alert color="failure">{imageUploadError}</Alert>}

        {formData.imageUrl && (
          <img
            src={imageFileUrl || formData.imageUrl}
            alt="upload"
            className="w-full h-72 object-cover"
          />
        )}

        <Button type="submit" gradientDuoTone="purpleToPink">
          Update Product
        </Button>

        {updateError && (
          <Alert className="mt-5" color="failure">
            {updateError}
          </Alert>
        )}
      </form>
    </div>
  );
};

export default UpdateProduct;