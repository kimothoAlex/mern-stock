import {
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { app } from "../fierbase";
import { useEffect, useMemo, useState } from "react";
import { CircularProgressbar } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Alert,
  Button,
  FileInput,
  Label,
  Select,
  TextInput,
  Textarea,
  Spinner,
  Table,
} from "flowbite-react";
import { enqueueSnackbar } from "notistack";

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
  "Hardware",
  "Tools",
  "Automotive",
  "Pet Supplies",
  "Other",
];

const UNITS = ["pcs", "kg", "g", "ltr", "ml", "box", "pack", "bottle", "can", "bag"];

const safeJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

// Helpers: convert entered qty to base unit qty (ml or g)
const toBaseQty = (qty, unit, baseUnit) => {
  const q = Number(qty || 0);
  if (!Number.isFinite(q) || q < 0) return 0;

  if (baseUnit === "ml") {
    if (unit === "ltr") return Math.round(q * 1000);
    if (unit === "ml") return Math.round(q);
    return 0;
  }

  if (baseUnit === "g") {
    if (unit === "kg") return Math.round(q * 1000);
    if (unit === "g") return Math.round(q);
    return 0;
  }

  return 0;
};

const UpdateProduct = () => {
  const [file, setFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(null);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [imageFileUrl, setImageFileUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);

  const [formData, setFormData] = useState(null);
  const [updateError, setUpdateError] = useState(null);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  // Variants UI state
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState([]); // existing variants from DB
  const [variantErr, setVariantErr] = useState("");

  // For base-stock editing (variant product)
  const [baseUnit, setBaseUnit] = useState("ml"); // ml | g
  const [baseStockInputUnit, setBaseStockInputUnit] = useState("ltr"); // ltr/ml or kg/g
  const [baseStockInputQty, setBaseStockInputQty] = useState("");

  // New variant rows (not saved yet)
  const [newVariants, setNewVariants] = useState([
    { name: "", barcode: "", price: "", sellUnit: "ltr", sizeInput: "" },
  ]);

  const { productId } = useParams();
  const navigate = useNavigate();

  // Derived: is this a variant/shared-stock product?
  const isVariantProduct = useMemo(() => {
    return Boolean(formData?.hasVariants || formData?.isBaseStock);
  }, [formData]);

  const variantSellUnits = useMemo(() => {
    return baseUnit === "ml" ? ["ltr", "ml"] : ["kg", "g"];
  }, [baseUnit]);

  // Keep units consistent when baseUnit changes
  useEffect(() => {
    if (baseUnit === "ml" && !["ltr", "ml"].includes(baseStockInputUnit)) setBaseStockInputUnit("ltr");
    if (baseUnit === "g" && !["kg", "g"].includes(baseStockInputUnit)) setBaseStockInputUnit("kg");

    // fix new rows sellUnit
    setNewVariants((prev) =>
      prev.map((v) => {
        const allowed = baseUnit === "ml" ? ["ltr", "ml"] : ["kg", "g"];
        return allowed.includes(v.sellUnit) ? v : { ...v, sellUnit: allowed[0], sizeInput: "" };
      })
    );
  }, [baseUnit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load product
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setUpdateError(null);
        const res = await fetch(`/api/product/getproducts?productId=${encodeURIComponent(productId)}`);
        const data = await safeJson(res);

        if (!res.ok) {
          setUpdateError(data?.message || "Failed to load product");
          return;
        }

        const product = data?.products?.[0];
        if (!product) {
          setUpdateError("Product not found");
          return;
        }

        setFormData({
          _id: product._id,
          slug: product.slug,
          name: product.name || "",
          barcode: product.barcode || "",
          category: product.category || "",
          price: product.price ?? "",
          quantity: product.quantity ?? "",
          unit: product.unit || "pcs",
          costPrice: product.costPrice ?? "",
          reorderLevel: product.reorderLevel ?? "",
          description: product.description || "",
          imageUrl: product.imageUrl || "",
          type: product.type || "general",

          // new fields
          hasVariants: Boolean(product.hasVariants),
          isBaseStock: Boolean(product.isBaseStock),
          baseUnit: product.baseUnit || "ml",
          stockBaseQty: product.stockBaseQty ?? 0,
        });

        // initialize base stock UI if variant product
        const detectedVariant = Boolean(product.hasVariants || product.isBaseStock);
        if (detectedVariant) {
          const bu = product.baseUnit || "ml";
          setBaseUnit(bu);

          // default input unit
          setBaseStockInputUnit(bu === "ml" ? "ltr" : "kg");

          // show current stock in a readable input unit (ltr/kg)
          if (bu === "ml") {
            setBaseStockInputQty(String((Number(product.stockBaseQty || 0) / 1000).toFixed(3)).replace(/\.?0+$/, ""));
          } else {
            setBaseStockInputQty(String((Number(product.stockBaseQty || 0) / 1000).toFixed(3)).replace(/\.?0+$/, ""));
          }
        }
      } catch (err) {
        setUpdateError(err?.message || "Failed to load product");
      }
    };

    fetchProduct();
  }, [productId]);

  // Load variants if variant product
  useEffect(() => {
    const loadVariants = async () => {
      if (!formData?._id) return;
      if (!isVariantProduct) {
        setVariants([]);
        return;
      }

      try {
        setVariantsLoading(true);
        setVariantErr("");

        const res = await fetch(`/api/variant/list?productId=${encodeURIComponent(formData._id)}`);
        const data = await safeJson(res);

        if (!res.ok) throw new Error(data?.message || "Failed to load variants");

        setVariants(Array.isArray(data?.variants) ? data.variants : []);
      } catch (e) {
        setVariants([]);
        setVariantErr(e?.message || "Failed to load variants");
      } finally {
        setVariantsLoading(false);
      }
    };

    loadVariants();
  }, [formData?._id, isVariantProduct]);

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
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
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
    }
  };

  // ---------- Variant CRUD helpers ----------
  const refreshVariants = async () => {
    if (!formData?._id) return;
    const res = await fetch(`/api/variant/list?productId=${encodeURIComponent(formData._id)}`);
    const data = await safeJson(res);
    if (res.ok) setVariants(Array.isArray(data?.variants) ? data.variants : []);
  };

  const updateExistingVariantLocal = (variantId, patch) => {
    setVariants((prev) => prev.map((v) => (String(v._id) === String(variantId) ? { ...v, ...patch } : v)));
  };

  const saveExistingVariant = async (v) => {
    try {
      setVariantErr("");

      // Minimal validation
      if (!String(v.name || "").trim()) throw new Error("Variant name required");
      if (v.price === "" || Number(v.price) < 0) throw new Error("Valid variant price required");
      if (!Number.isFinite(Number(v.unitSizeInBase)) || Number(v.unitSizeInBase) <= 0)
        throw new Error("Variant size (unitSizeInBase) must be > 0");

      const payload = {
        name: String(v.name || "").trim(),
        barcode: String(v.barcode || "").trim() || undefined,
        price: Number(v.price),
        unitSizeInBase: Number(v.unitSizeInBase), // already in base unit
        isActive: v.isActive !== false,
      };

      const res = await fetch(`/api/variant/update/${encodeURIComponent(v._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Failed to update variant");

      enqueueSnackbar("Variant updated", { variant: "success" });
      await refreshVariants();
    } catch (e) {
      setVariantErr(e?.message || "Failed to update variant");
    }
  };

  const deleteExistingVariant = async (variantId) => {
    const ok = window.confirm("Delete this variant? This cannot be undone.");
    if (!ok) return;

    try {
      setVariantErr("");
      const res = await fetch(`/api/variant/delete/${encodeURIComponent(variantId)}`, {
        method: "DELETE",
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.message || "Failed to delete variant");

      enqueueSnackbar("Variant deleted", { variant: "success" });
      await refreshVariants();
    } catch (e) {
      setVariantErr(e?.message || "Failed to delete variant");
    }
  };

  const addNewVariantRow = () => {
    setNewVariants((prev) => [...prev, { name: "", barcode: "", price: "", sellUnit: variantSellUnits[0], sizeInput: "" }]);
  };

  const removeNewVariantRow = (idx) => {
    setNewVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateNewVariantRow = (idx, patch) => {
    setNewVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const createNewVariants = async () => {
    try {
      if (!formData?._id) return;
      setVariantErr("");

      // Validate rows
      for (const v of newVariants) {
        if (!String(v.name || "").trim()) throw new Error("Each new variant must have a name");
        if (v.price === "" || Number(v.price) < 0) throw new Error(`Valid price required for "${v.name || "variant"}"`);
        if (v.sizeInput === "" || Number(v.sizeInput) <= 0) throw new Error(`Valid size required for "${v.name || "variant"}"`);
        if (!v.sellUnit) throw new Error(`sellUnit required for "${v.name || "variant"}"`);
      }

      // Create sequentially so you get clear error messages (barcode duplicates etc.)
      for (const v of newVariants) {
        const unitSizeInBase = toBaseQty(v.sizeInput, v.sellUnit, baseUnit);
        if (!unitSizeInBase || unitSizeInBase <= 0) throw new Error(`Invalid size conversion for "${v.name}"`);

        const payload = {
          productId: formData._id,
          name: String(v.name || "").trim(),
          barcode: String(v.barcode || "").trim() || undefined,
          sellUnit: String(v.sellUnit || "").trim(),
          unitSizeInBase,
          price: Number(v.price),
        };

        const res = await fetch(`/api/variant/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || `Failed to create variant: ${v.name}`);
      }

      enqueueSnackbar("New variants added", { variant: "success" });
      setNewVariants([{ name: "", barcode: "", price: "", sellUnit: variantSellUnits[0], sizeInput: "" }]);
      await refreshVariants();
    } catch (e) {
      setVariantErr(e?.message || "Failed to add variants");
    }
  };

  // ---------- Save product ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData) return;

    if (imageUploading) {
      setImageUploadError("Please wait for image to upload");
      return;
    }

    try {
      setUpdateError(null);

      // Basic validation
      if (!formData.name.trim()) return setUpdateError("Product name is required");
      if (!formData.category.trim()) return setUpdateError("Category is required");

      // NORMAL PRODUCT validation
      if (!isVariantProduct) {
        if (formData.price === "" || Number(formData.price) < 0) return setUpdateError("Valid price is required");
        if (formData.quantity === "" || Number(formData.quantity) < 0) return setUpdateError("Valid quantity is required");
      }

      // Build payload by mode
      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        description: formData.description?.trim() || "",
        imageUrl: formData.imageUrl || "",
        type: (formData.type || "general").trim(),
        costPrice: formData.costPrice === "" ? undefined : Number(formData.costPrice),
        reorderLevel: formData.reorderLevel === "" ? undefined : Number(formData.reorderLevel),
      };

      if (isVariantProduct) {
        // Update base stock fields, keep "normal" fields neutral
        const stockBaseQty = toBaseQty(baseStockInputQty, baseStockInputUnit, baseUnit);

        payload.hasVariants = true;      // consistent with your schema
        payload.isBaseStock = true;      // for your UI checks
        payload.baseUnit = baseUnit;
        payload.stockBaseQty = stockBaseQty;

        payload.price = 0;
        payload.quantity = 0;
        payload.barcode = undefined;
        payload.unit = baseUnit;
      } else {
        // normal product fields
        payload.price = Number(formData.price);
        payload.quantity = Number(formData.quantity);
        payload.unit = formData.unit || "pcs";
        payload.barcode = formData.barcode.trim() || undefined;
      }

      const res = await fetch(`/api/product/update/${encodeURIComponent(formData._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setUpdateError(data?.message || "Failed to update product");
        return;
      }

      enqueueSnackbar("Product Updated!", { variant: "success" });
      navigate(`/product/${data?.slug || formData.slug}`);
    } catch (error) {
      setUpdateError("Something went wrong");
    }
  };

  if (!formData) {
    return (
      <div className="p-3 max-w-3xl mx-auto min-h-screen">
        <Alert color="info">Loading product...</Alert>
        {updateError && (
          <Alert color="failure" className="mt-4">
            {updateError}
          </Alert>
        )}
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                required
              />
            )}
          </div>
        </div>

        {/* MODE BADGE */}
        <div className="rounded-lg border p-3 bg-white dark:bg-gray-800">
          <div className="text-sm text-gray-500">Mode</div>
          <div className="font-semibold">
            {isVariantProduct ? `Variant / Shared stock (base: ${baseUnit})` : "Normal product"}
          </div>
          {isVariantProduct && (
            <div className="text-xs text-gray-500">
              This page updates product + variants. Selling happens in POS by scanning/searching variants.
            </div>
          )}
        </div>

        {/* NORMAL PRODUCT FIELDS */}
        {!isVariantProduct && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="barcode" value="Barcode (optional)" />
              <TextInput
                id="barcode"
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <Label value="Cost Price (optional)" />
                <TextInput
                  type="number"
                  min="0"
                  value={formData.costPrice}
                  onChange={(e) => setFormData((p) => ({ ...p, costPrice: e.target.value }))}
                />
              </div>

              <div>
                <Label value="Unit" />
                <Select value={formData.unit} onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              <div>
                <Label value="Reorder Level (optional)" />
                <TextInput
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData((p) => ({ ...p, reorderLevel: e.target.value }))}
                />
              </div>
            </div>
          </>
        )}

        {/* VARIANT PRODUCT BASE STOCK */}
        {isVariantProduct && (
          <div className="border rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800">
            <div>
              <div className="font-semibold">Base Stock</div>
              <div className="text-xs text-gray-500">Stored as ml (liquid) or g (dry).</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label value="Base Unit (storage)" />
                <Select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                </Select>
              </div>

              <div>
                <Label value="Stock Input Unit" />
                <Select value={baseStockInputUnit} onChange={(e) => setBaseStockInputUnit(e.target.value)}>
                  {baseUnit === "ml" ? (
                    <>
                      <option value="ltr">ltr</option>
                      <option value="ml">ml</option>
                    </>
                  ) : (
                    <>
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                    </>
                  )}
                </Select>
              </div>

              <div>
                <Label value="Base Stock Qty" />
                <TextInput
                  type="number"
                  min="0"
                  value={baseStockInputQty}
                  onChange={(e) => setBaseStockInputQty(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Stored as:{" "}
                  <b>{toBaseQty(baseStockInputQty, baseStockInputUnit, baseUnit).toLocaleString()}</b> {baseUnit}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <Label value="Description (optional)" />
          <Textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        {/* Image */}
        {/* <div className="flex gap-4 items-center justify-between border-4 border-teal-500 border-dotted p-3">
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
        </div> */}

        {/* {imageUploadError && <Alert color="failure">{imageUploadError}</Alert>}

        {formData.imageUrl && (
          <img src={imageFileUrl || formData.imageUrl} alt="upload" className="w-full h-72 object-cover" />
        )} */}

        {/* PRODUCT SAVE BUTTON */}
        <Button type="submit" gradientDuoTone="purpleToPink">
          Update Product
        </Button>

        {updateError && (
          <Alert className="mt-2" color="failure">
            {updateError}
          </Alert>
        )}

        {/* VARIANTS SECTION */}
        {isVariantProduct && (
          <div className="mt-6 border rounded-lg p-4 bg-white dark:bg-gray-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xl font-semibold">Variants</div>
                <div className="text-xs text-gray-500">
                  Existing variants can be edited below. You can also add new ones.
                </div>
              </div>

              <Button color="light" type="button" onClick={refreshVariants} disabled={variantsLoading}>
                {variantsLoading ? <Spinner size="sm" /> : "Refresh Variants"}
              </Button>
            </div>

            {variantErr && <Alert color="failure">{variantErr}</Alert>}

            {/* Existing variants */}
            {variantsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner size="sm" /> Loading variants...
              </div>
            ) : !variants.length ? (
              <div className="text-sm text-gray-500">No variants found.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table hoverable>
                  <Table.Head>
                    <Table.HeadCell>Name</Table.HeadCell>
                    <Table.HeadCell>Barcode</Table.HeadCell>
                    <Table.HeadCell className="text-right">Size (base)</Table.HeadCell>
                    <Table.HeadCell className="text-right">Price</Table.HeadCell>
                    <Table.HeadCell>Status</Table.HeadCell>
                    <Table.HeadCell />
                  </Table.Head>

                  <Table.Body className="divide-y">
                    {variants.map((v) => (
                      <Table.Row key={v._id}>
                        <Table.Cell>
                          <TextInput
                            value={v.name || ""}
                            onChange={(e) => updateExistingVariantLocal(v._id, { name: e.target.value })}
                          />
                        </Table.Cell>

                        <Table.Cell>
                          <TextInput
                            value={v.barcode || ""}
                            onChange={(e) => updateExistingVariantLocal(v._id, { barcode: e.target.value })}
                          />
                        </Table.Cell>

                        <Table.Cell className="text-right">
                          <TextInput
                            type="number"
                            min="0"
                            value={v.unitSizeInBase ?? 0}
                            onChange={(e) => updateExistingVariantLocal(v._id, { unitSizeInBase: e.target.value })}
                          />
                          <div className="text-xs text-gray-500 mt-1">{baseUnit}</div>
                        </Table.Cell>

                        <Table.Cell className="text-right">
                          <TextInput
                            type="number"
                            min="0"
                            value={v.price ?? 0}
                            onChange={(e) => updateExistingVariantLocal(v._id, { price: e.target.value })}
                          />
                        </Table.Cell>

                        <Table.Cell>
                          <Select
                            value={v.isActive === false ? "INACTIVE" : "ACTIVE"}
                            onChange={(e) => updateExistingVariantLocal(v._id, { isActive: e.target.value === "ACTIVE" })}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                          </Select>
                        </Table.Cell>

                        <Table.Cell className="flex gap-2">
                          <Button size="xs" color="success" type="button" onClick={() => saveExistingVariant(v)}>
                            Save
                          </Button>
                          <Button size="xs" color="failure" type="button" onClick={() => deleteExistingVariant(v._id)}>
                            Delete
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}

            {/* Add new variants */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-semibold">Add New Variants</div>
                <Button type="button" color="light" onClick={addNewVariantRow}>
                  + Add Row
                </Button>
              </div>

              {newVariants.map((v, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">New Variant #{idx + 1}</div>
                    <Button
                      size="xs"
                      color="failure"
                      type="button"
                      onClick={() => removeNewVariantRow(idx)}
                      disabled={newVariants.length === 1}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label value="Name" />
                      <TextInput
                        value={v.name}
                        onChange={(e) => updateNewVariantRow(idx, { name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label value="Barcode (optional)" />
                      <TextInput
                        value={v.barcode}
                        onChange={(e) => updateNewVariantRow(idx, { barcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label value="Sell Unit" />
                      <Select
                        value={v.sellUnit}
                        onChange={(e) => updateNewVariantRow(idx, { sellUnit: e.target.value, sizeInput: "" })}
                      >
                        {variantSellUnits.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Label value="Size (sell unit)" />
                      <TextInput
                        type="number"
                        min="0"
                        value={v.sizeInput}
                        onChange={(e) => updateNewVariantRow(idx, { sizeInput: e.target.value })}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Converts to: <b>{toBaseQty(v.sizeInput, v.sellUnit, baseUnit).toLocaleString()}</b> {baseUnit}
                      </div>
                    </div>

                    <div>
                      <Label value="Price (KES)" />
                      <TextInput
                        type="number"
                        min="0"
                        value={v.price}
                        onChange={(e) => updateNewVariantRow(idx, { price: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" color="success" onClick={createNewVariants}>
                Save New Variants
              </Button>
            </div>
          </div>
        )}

        <div className="pt-6">
          <Button color="light" type="button" onClick={() => navigate(`/product/${formData.slug}`)}>
            Back to Product
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UpdateProduct;
