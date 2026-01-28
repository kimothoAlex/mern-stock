import { useState } from "react";
import { enqueueSnackbar } from "notistack";
import { Alert, Button, FileInput, Label, Select, TextInput, Textarea } from "flowbite-react";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { app } from "../fierbase";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useNavigate, Link } from "react-router-dom";

const DEFAULT_CATEGORIES = [
  "Grocery",
  "Drinks",
  "Snacks",
  "Dairy",
  "Bakery",
  "Meat & Poultry",
  "Fish & Seafood",
  "Fruits & Vegetables",
  "Cereals & Grains",
  "Flour & Baking",
  "Spices & Condiments",
  "Cooking Oil",
  "Sugar & Sweeteners",
  "Tea, Coffee & Cocoa",
  "Baby Products",
  "Personal Care",
  "Health & Pharmacy",
  "Beauty & Cosmetics",
  "Cleaning",
  "Laundry",
  "Paper & Tissue",
  "Stationery",
  "Electronics",
  "Phone Accessories",
  "Home & Kitchen",
  "Utensils",
  "Hardware",
  "Tools",
  "Automotive",
  "Pet Supplies",
  "Alcoholic Drinks",
  "Tobacco",
  "Other",
];

const UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pack"];

const CreateProduct = () => {
  const [file, setFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(null);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    category: "",
    price: "",
    quantity: "",
    unit: "pcs",
    costPrice: "",
    reorderLevel: "",
    description: "",
    imageUrl: "",
    // type removed (optional). If your backend requires it, set a default like "general".
    type: "general",
  });

  const navigate = useNavigate();

  const handleUpdloadImage = async () => {
    try {
      if (!file) {
        setImageUploadError("Please select an image");
        return;
      }
      setImageUploadError(null);
      const storage = getStorage(app);
      const fileName = new Date().getTime() + "-" + file.name;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setImageUploadProgress(progress.toFixed(0));
        },
        () => {
          setImageUploadError("Image upload failed");
          setImageUploadProgress(null);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setImageUploadProgress(null);
            setImageUploadError(null);
            setFormData((prev) => ({ ...prev, imageUrl: downloadURL }));
          });
        }
      );
    } catch (error) {
      setImageUploadError("Image upload failed");
      setImageUploadProgress(null);
      console.log(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setPublishError(null);

      // Basic front-end validation
      if (!formData.name.trim()) return setPublishError("Product name is required");
      if (!formData.category.trim()) return setPublishError("Category is required");
      if (formData.price === "" || Number(formData.price) < 0) return setPublishError("Valid price is required");
      if (formData.quantity === "" || Number(formData.quantity) < 0) return setPublishError("Valid quantity is required");

      // Send numeric fields as numbers
      const payload = {
        ...formData,
        price: Number(formData.price),
        quantity: Number(formData.quantity),
        costPrice: formData.costPrice === "" ? undefined : Number(formData.costPrice),
        reorderLevel: formData.reorderLevel === "" ? undefined : Number(formData.reorderLevel),
        barcode: formData.barcode.trim() || undefined, // optional
      };

      const res = await fetch("/api/product/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.message || "Failed to create product");
        return;
      }

      enqueueSnackbar("Product Created Successfully", { variant: "success" });
      navigate(`/product/${data.slug}`);
    } catch (error) {
      setPublishError("Something went wrong");
    }
  };

  return (
    <div className="p-3 max-w-3xl mx-auto min-h-screen">
      <div className="flex items-center justify-between my-7">
        <h1 className="font-semibold text-3xl">Add Product</h1>

        <Link to="/barcode" className="text-sm font-semibold text-teal-600 hover:underline">
          Scan / Find Barcode
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name + Category */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Label value="Product Name" />
            <TextInput
              type="text"
              placeholder="e.g., Sugar 1kg"
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
                  <option key={c} value={c}>
                    {c}
                  </option>
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

        {/* Barcode (optional) */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="barcode" value="Barcode (optional)" />
          <TextInput
            type="text"
            placeholder="Scan or type barcode (leave empty if none)"
            id="barcode"
            value={formData.barcode}
            onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
          />
          <p className="text-xs text-gray-500">
            If you use a barcode scanner, click here and scan—most scanners type into the field automatically.
          </p>
        </div>

        {/* Price + Cost + Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label value="Selling Price" />
            <TextInput
              type="number"
              placeholder="e.g., 120"
              min="0"
              required
              value={formData.price}
              onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
            />
          </div>

          <div>
            <Label value="Cost Price (optional)" />
            <TextInput
              type="number"
              placeholder="e.g., 90"
              min="0"
              value={formData.costPrice}
              onChange={(e) => setFormData((p) => ({ ...p, costPrice: e.target.value }))}
            />
          </div>

          <div>
            <Label value="Unit" />
            <Select
              value={formData.unit}
              onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Quantity + Reorder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label value="Stock Quantity" />
            <TextInput
              type="number"
              placeholder="e.g., 50"
              min="0"
              required
              value={formData.quantity}
              onChange={(e) => setFormData((p) => ({ ...p, quantity: e.target.value }))}
            />
          </div>

          <div>
            <Label value="Reorder Level (optional)" />
            <TextInput
              type="number"
              placeholder="e.g., 5"
              min="0"
              value={formData.reorderLevel}
              onChange={(e) => setFormData((p) => ({ ...p, reorderLevel: e.target.value }))}
            />
            <p className="text-xs text-gray-500">You can alert when stock goes below this number.</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <Label value="Description (optional)" />
          <Textarea
            placeholder="Any notes (brand, size, supplier, etc.)"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Image upload */}
        {/* <div className="flex items-center justify-between border-4 border-teal-500 border-dotted p-3">
          <FileInput type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <Button
            gradientDuoTone="purpleToBlue"
            outline
            size="sm"
            onClick={handleUpdloadImage}
            disabled={imageUploadProgress}
            type="button"
          >
            {imageUploadProgress ? (
              <div className="w-16 h-16">
                <CircularProgressbar value={imageUploadProgress} text={`${imageUploadProgress || 0}%`} />
              </div>
            ) : (
              "Upload Image"
            )}
          </Button>
        </div> */}

        {imageUploadError && <Alert color="failure">{imageUploadError}</Alert>}

        {formData.imageUrl && (
          <img src={formData.imageUrl} alt="upload" className="w-full h-72 object-cover" />
        )}

        <Button type="submit" gradientDuoTone="purpleToPink">
          Save Product
        </Button>

        {publishError && (
          <Alert className="mt-5" color="failure">
            {publishError}
          </Alert>
        )}
      </form>
    </div>
  );
};

export default CreateProduct;