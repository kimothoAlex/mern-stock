import { useMemo, useState, useEffect } from "react";
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

// Convert qty in input unit -> qty in base unit (ml or g)
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

const CreateProduct = () => {
  const [file, setFile] = useState(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(null);
  const [imageUploadError, setImageUploadError] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  // ✅ Toggle variant mode
  const [hasVariants, setHasVariants] = useState(false);

  // ✅ base stock inputs (for variants)
  const [baseUnit, setBaseUnit] = useState("ml"); // ml | g
  const [baseStockInputUnit, setBaseStockInputUnit] = useState("ltr"); // ltr/ml or kg/g
  const [baseStockInputQty, setBaseStockInputQty] = useState("");

  // ✅ allowed sell units depend on baseUnit
  const variantSellUnits = useMemo(() => {
    return baseUnit === "ml" ? ["ltr", "ml"] : ["kg", "g"];
  }, [baseUnit]);

  // ✅ variants list
  const [variants, setVariants] = useState([
    { name: "", barcode: "", price: "", sellUnit: "ltr", sizeInput: "" },
  ]);

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
    type: "general",
  });

  const navigate = useNavigate();

  // ✅ Keep units consistent when baseUnit changes
  useEffect(() => {
    // base stock input unit
    if (baseUnit === "ml" && !["ltr", "ml"].includes(baseStockInputUnit)) setBaseStockInputUnit("ltr");
    if (baseUnit === "g" && !["kg", "g"].includes(baseStockInputUnit)) setBaseStockInputUnit("kg");

    // fix variant rows sellUnit
    setVariants((prev) =>
      prev.map((v) => {
        const allowed = baseUnit === "ml" ? ["ltr", "ml"] : ["kg", "g"];
        return allowed.includes(v.sellUnit)
          ? v
          : { ...v, sellUnit: allowed[0], sizeInput: "" };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUnit]);

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

  const addVariantRow = () => {
    const defaultSellUnit = baseUnit === "ml" ? "ltr" : "kg";
    setVariants((prev) => [
      ...prev,
      { name: "", barcode: "", price: "", sellUnit: defaultSellUnit, sizeInput: "" },
    ]);
  };

  const removeVariantRow = (idx) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVariant = (idx, patch) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  };

  const validateVariantProduct = () => {
    if (!formData.name.trim()) return "Product name is required";
    if (!formData.category.trim()) return "Category is required";

    if (!["ml", "g"].includes(baseUnit)) return "Base unit must be ml or g";
    if (baseStockInputQty === "" || Number(baseStockInputQty) < 0) return "Valid base stock quantity is required";

    const stockBaseQty = toBaseQty(baseStockInputQty, baseStockInputUnit, baseUnit);
    if (!Number.isFinite(stockBaseQty) || stockBaseQty < 0) return "Base stock is invalid";

    if (!variants.length) return "Add at least 1 variant";

    for (const v of variants) {
      const vName = String(v.name || "").trim();
      if (!vName) return "Each variant must have a name";
      if (v.price === "" || Number(v.price) < 0) return `Valid price required for variant: ${vName}`;
      if (v.sizeInput === "" || Number(v.sizeInput) <= 0) return `Valid size required for variant: ${vName}`;
      if (!v.sellUnit) return `sellUnit required for variant: ${vName}`;

      // ensure unit pair matches baseUnit
      if (baseUnit === "ml" && !["ltr", "ml"].includes(v.sellUnit)) return `Invalid sellUnit for ${vName}`;
      if (baseUnit === "g" && !["kg", "g"].includes(v.sellUnit)) return `Invalid sellUnit for ${vName}`;
    }

    // prevent duplicate barcodes in form
    const barcodes = variants.map((v) => String(v.barcode || "").trim()).filter(Boolean);
    if (new Set(barcodes).size !== barcodes.length) return "Duplicate variant barcode detected in the form";

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPublishError(null);

    try {
      // ===== NORMAL PRODUCT =====
      if (!hasVariants) {
        if (!formData.name.trim()) return setPublishError("Product name is required");
        if (!formData.category.trim()) return setPublishError("Category is required");
        if (formData.price === "" || Number(formData.price) < 0) return setPublishError("Valid price is required");
        if (formData.quantity === "" || Number(formData.quantity) < 0) return setPublishError("Valid quantity is required");

        const payload = {
          name: formData.name.trim(),
          category: formData.category.trim(),
          type: formData.type || "general",
          description: String(formData.description || "").trim(),
          imageUrl: formData.imageUrl || undefined,

          hasVariants: false, // ✅ consistent
          price: Number(formData.price),
          quantity: Number(formData.quantity),
          unit: formData.unit || "pcs",
          barcode: String(formData.barcode || "").trim() || undefined,
          costPrice: formData.costPrice === "" ? undefined : Number(formData.costPrice),
          reorderLevel: formData.reorderLevel === "" ? undefined : Number(formData.reorderLevel),
        };

        const res = await fetch("/api/product/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) return setPublishError(data.message || "Failed to create product");

        enqueueSnackbar("Product Created Successfully", { variant: "success" });
        navigate(`/product/${data.slug}`);
        return;
      }

      // ===== VARIANT (BASE-STOCK) PRODUCT =====
      const err = validateVariantProduct();
      if (err) return setPublishError(err);

      const stockBaseQty = toBaseQty(baseStockInputQty, baseStockInputUnit, baseUnit);

      const mappedVariants = variants.map((v) => {
        const unitSizeInBase = toBaseQty(v.sizeInput, v.sellUnit, baseUnit);
        return {
          name: String(v.name || "").trim(),
          barcode: String(v.barcode || "").trim() || undefined,
          price: Number(v.price),
          sellUnit: String(v.sellUnit || "").trim(),
          unitSizeInBase,
        };
      });

      const payload = {
        name: formData.name.trim(),
        category: formData.category.trim(),
        type: formData.type || "general",
        description: String(formData.description || "").trim(),
        imageUrl: formData.imageUrl || undefined,

        // ✅ consistent with updated model + backward-compatible with your controller
        hasVariants: true,
        isBaseStock: true,

        baseUnit,
        stockBaseQty,

        // base product not sold directly
        price: 0,
        quantity: 0,
        barcode: undefined,
        unit: baseUnit,

        costPrice: formData.costPrice === "" ? undefined : Number(formData.costPrice),
        reorderLevel: formData.reorderLevel === "" ? undefined : Number(formData.reorderLevel),

        variants: mappedVariants,
      };

      const res = await fetch("/api/product/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) return setPublishError(data.message || "Failed to create product with variants");

      enqueueSnackbar("Variant Product Created Successfully", { variant: "success" });

      const slug = data?.product?.slug || data?.slug;
      if (slug) navigate(`/product/${slug}`);
      else navigate("/dashboard?tab=products");
    } catch (error) {
      setPublishError(error?.message || "Something went wrong");
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
        {/* Product Name + Category */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Label value="Product Name" />
            <TextInput
              type="text"
              placeholder={hasVariants ? "e.g., Milk" : "e.g., Sugar 1kg"}
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

        {/* Toggle Variants */}
        <div className="border rounded-lg p-3 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">Variants / Shared Stock</div>
              <div className="text-xs text-gray-500">
                Use this for milk/cereals where many sizes share the same stock.
              </div>
            </div>

            <Button
              type="button"
              color={hasVariants ? "failure" : "success"}
              onClick={() => {
                setPublishError(null);
                setHasVariants((v) => !v);
                setFormData((p) => ({
                  ...p,
                  barcode: "",
                  quantity: "",
                }));
              }}
            >
              {hasVariants ? "Disable Variants" : "Enable Variants"}
            </Button>
          </div>
        </div>

        {/* Barcode (normal product only) */}
        {!hasVariants && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="barcode" value="Barcode (optional)" />
            <TextInput
              type="text"
              placeholder="Scan or type barcode (leave empty if none)"
              id="barcode"
              value={formData.barcode}
              onChange={(e) => setFormData((p) => ({ ...p, barcode: e.target.value }))}
            />
          </div>
        )}

        {/* Normal product pricing/stock */}
        {!hasVariants && (
          <>
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
              </div>
            </div>
          </>
        )}

        {/* Variant product base stock + variants */}
        {hasVariants && (
          <div className="border rounded-lg p-4 space-y-4 bg-white dark:bg-gray-800">
            <div>
              <div className="font-semibold">Base Stock</div>
              <div className="text-xs text-gray-500">
                Store stock in a base unit (ml for liquids, g for cereals/flour).
              </div>
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
                  placeholder={baseUnit === "ml" ? "e.g. 100 (ltr)" : "e.g. 50 (kg)"}
                  value={baseStockInputQty}
                  onChange={(e) => setBaseStockInputQty(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Stored as:{" "}
                  <b>{toBaseQty(baseStockInputQty, baseStockInputUnit, baseUnit).toLocaleString()}</b> {baseUnit}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-semibold">Variants</div>
              <Button type="button" onClick={addVariantRow} color="light">
                + Add Variant
              </Button>
            </div>

            <div className="space-y-3">
              {variants.map((v, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-semibold">Variant #{idx + 1}</div>
                    <Button
                      type="button"
                      color="failure"
                      size="xs"
                      onClick={() => removeVariantRow(idx)}
                      disabled={variants.length === 1}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label value="Variant Name" />
                      <TextInput
                        placeholder={baseUnit === "ml" ? "e.g. Milk 20L" : "e.g. Cereals 500g"}
                        value={v.name}
                        onChange={(e) => updateVariant(idx, { name: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label value="Variant Barcode (optional but recommended)" />
                      <TextInput
                        placeholder="e.g. MILK20"
                        value={v.barcode}
                        onChange={(e) => updateVariant(idx, { barcode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label value="Sell Unit" />
                      <Select value={v.sellUnit} onChange={(e) => updateVariant(idx, { sellUnit: e.target.value })}>
                        {variantSellUnits.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <Label value="Size (in sell unit)" />
                      <TextInput
                        type="number"
                        min="0"
                        placeholder={v.sellUnit === "ltr" ? "e.g. 20" : v.sellUnit === "kg" ? "e.g. 0.5" : "e.g. 500"}
                        value={v.sizeInput}
                        onChange={(e) => updateVariant(idx, { sizeInput: e.target.value })}
                      />
                      <p className="text-xs text-gray-500">
                        Converts to:{" "}
                        <b>{toBaseQty(v.sizeInput, v.sellUnit, baseUnit).toLocaleString()}</b> {baseUnit}
                      </p>
                    </div>

                    <div>
                      <Label value="Price (KES)" />
                      <TextInput
                        type="number"
                        min="0"
                        placeholder="e.g. 500"
                        value={v.price}
                        onChange={(e) => updateVariant(idx, { price: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label value="Reorder Level (optional, in base unit)" />
                <TextInput
                  type="number"
                  placeholder={baseUnit === "ml" ? "e.g. 5000 (ml)" : "e.g. 2000 (g)"}
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData((p) => ({ ...p, reorderLevel: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

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
                <CircularProgressbar value={imageUploadProgress} text={`${imageUploadProgress}%`} />
              </div>
            ) : (
              "Upload Image"
            )}
          </Button>
        </div>

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
