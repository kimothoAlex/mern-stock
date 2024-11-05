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
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Alert, Button, FileInput, Select, TextInput } from "flowbite-react";
import { enqueueSnackbar } from "notistack";
const UpdateProduct = () => {
  const [file, setFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(null);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [imageFileUrl, setImageFileUrl] = useState(null);
  const [formData, setFormData] = useState({});
  const [updateError, setUpdateError] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const { productId } = useParams();
  console.log(formData);

  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);

  useEffect(() => {
    try {
      const fetchProduct = async () => {
        const res = await fetch(
          `/api/product/getproducts?productId=${productId}`
        );
        const data = await res.json();
        if (!res.ok) {
          console.log(data.message);
          setUpdateError(data.message);
          return;
        }
        if (res.ok) {
          setUpdateError(null);
          setFormData(data.products[0]);
        }
      };

      fetchProduct();
    } catch (error) {
      console.log(error.message);
    }
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
        (error) => {
          setImageUploadError("Image upload failed");
          setImageUploadProgress(null);
          setImageUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            setImageFileUrl(downloadURL);
            setImageUploadProgress(null);
            setImageUploadError(null);
            setFormData({ ...formData, imageUrl: downloadURL });
            setImageUploading(false);
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
    if (imageUploading) {
      setImageUploadError(" Please wait for image to upload");
      return;
    }
    try {
      const res = await fetch(`/api/product/update/${formData._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setUpdateError(data.message);
        return;
      }

      if (res.ok) {
        setUpdateError(null);
        enqueueSnackbar("Product Updated!", { variant: "success" });
        navigate(`/product/${data.slug}`);
      }
    } catch (error) {
      setUpdateError("Something went wrong");
    }
  };
  return (
    <div className="p-3 max-w-3xl mx-auto min-h-screen">
      <h1 className="text-center text-3xl my-7 font-semibold">
        Update product
      </h1>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-4 sm:flex-row justify-between">
          <TextInput
            type="text"
            placeholder="Name"
            required
            id="name"
            className="flex-1"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            value={formData.name}
          />
          <TextInput
            type="number"
            placeholder="Price"
            required
            id="price"
            className="flex-1"
            onChange={(e) =>
              setFormData({ ...formData, price: e.target.value })
            }
            value={formData.price}
          />
          <TextInput
            type="number"
            placeholder="Quantity"
            required
            id="quantity"
            className="flex-1"
            onChange={(e) =>
              setFormData({ ...formData, quantity: e.target.value })
            }
            value={formData.quantity}
          />
          <Select
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            value={formData.category}
          >
            <option value="uncategorized">Select a category</option>
            <option value="750ml">750ml</option>
            <option value="350ml">350ml</option>
            <option value="250ml">250ml</option>
            <option value="125ml">125ml</option>
          </Select>
          <Select
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            value={formData.type}
          >
            <option value="uncategorized">Select type</option>
            <option value="beer">Beer</option>
            <option value="wine">Wine</option>
            <option value="spirit">Spirit</option>
            <option value="gin">Gin</option>
            <option value="whisky">Whisky</option>
            <option value="vodka">Vodka</option>
            <option value="brandy">Brandy</option>
          </Select>
        </div>
        <div className="flex gap-4 items-center justify-between border-4 border-teal-500 border-dotted p-3">
          <FileInput
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
          />
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
                <CircularProgressbar
                  value={imageUploadProgress}
                  text={`${imageUploadProgress || 0}%`}
                />
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
          Update product
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
