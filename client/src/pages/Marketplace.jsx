import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  ShoppingBag,
  Book,
  Watch,
  Plus,
  Search,
  MapPin,
  Tag,
  X,
  Truck,
  Package,
  Image as ImageIcon,
  MessageCircle,
  Trash2,
  Camera,
  Edit2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import EmptyState from "@/components/ui/EmptyState";
import UserInfo from "@/components/ui/UserInfo";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

import { createPortal } from "react-dom";
import {
  getProducts,
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/services/productService";
import {
  getBannerThemeClasses,
  getCardThemeClasses,
  getPrimaryButtonClasses,
  getOptionClasses,
} from "@/utils/themeUtils";

const Marketplace = () => {
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const { appTheme, isDark } = useTheme();

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [newProduct, setNewProduct] = useState({
    title: "",
    price: "",
    category: "Books",
    condition: "Good",
    location: "",
    description: "",
    deliveryOptions: ["Pickup"],
    status: "Available",
  });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await getProducts();
        setProducts(Array.isArray(data) ? data : data?.products || []);
      } catch (err) {
        console.error("Failed to load products", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      activeCategory === "All" || p.category === activeCategory;
    const title = String(p?.title || "");
    const description = String(p?.description || "");
    const matchesSearch =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePostProduct = async (e) => {
    e.preventDefault();
    setIsPosting(true);
    try {
      const formData = new FormData();
      formData.append("title", newProduct.title);
      formData.append("price", newProduct.price);
      formData.append("category", newProduct.category);
      formData.append("condition", newProduct.condition);
      formData.append("location", newProduct.location);
      formData.append("description", newProduct.description);
      newProduct.deliveryOptions.forEach((opt) => {
        formData.append("deliveryOptions", opt);
      });
      if (newProduct.status) {
        formData.append("status", newProduct.status);
      }

      // Attach Retained Images and New Files
      const retainedIds = previewImages
        .filter((img) => img.isRetained)
        .map((img) => img._id);
      retainedIds.forEach((id) => formData.append("retainedMediaIds", id));

      const newFiles = previewImages
        .filter((img) => !img.isRetained)
        .map((img) => img.file);
      newFiles.forEach((file) => {
        formData.append("images", file);
      });

      if (editingProductId) {
        const updatedProduct = await updateProduct(editingProductId, formData);
        setProducts(
          products.map((p) =>
            p._id === editingProductId ? updatedProduct : p,
          ),
        );
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Listing updated successfully! ✏️",
          }),
        );
      } else {
        const addedProduct = await createProduct(formData);
        setProducts([addedProduct, ...products]);
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: "Product listed successfully! 🛒",
          }),
        );
      }
      closeModal();
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: `Failed to ${editingProductId ? "update" : "list"} product. ❌`,
        }),
      );
    } finally {
      setIsPosting(false);
    }
  };

  const closeModal = () => {
    setIsAddModalOpen(false);
    setEditingProductId(null);
    setNewProduct({
      title: "",
      price: "",
      category: "Books",
      condition: "Good",
      location: "",
      description: "",
      deliveryOptions: ["Pickup"],
      status: "Available",
    });
    setPreviewImages([]);
  };

  const openEditModal = (product) => {
    setEditingProductId(product._id);
    setNewProduct({
      title: product.title,
      price: product.price,
      category: product.category,
      condition: product.condition,
      location: product.location || "",
      description: product.description,
      deliveryOptions: product.deliveryOptions || ["Pickup"],
      status: product.status || "Available",
    });
    setPreviewImages(
      Array.isArray(product.images)
        ? product.images.map((img) => {
            const imgPath = typeof img === "string" ? img : img.path;
            return {
              url: imgPath?.startsWith("http") ? imgPath : `/${imgPath}`,
              isRetained: true,
              _id: typeof img === "string" ? img : img._id,
            };
          })
        : [],
    );
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this listing?"))
      return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      window.dispatchEvent(
        new CustomEvent("showToast", { detail: "Listing deleted! 🗑️" }),
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: "Failed to delete listing. ❌",
        }),
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div
        className={`${getBannerThemeClasses(appTheme, "bg-gradient-to-r from-teal-500 to-emerald-600 text-white")} rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors`}
      >
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10">
          <ShoppingBag className="w-64 h-64" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-3">
            Campus Marketplace
          </h1>
          <p className="mt-2 text-base md:text-lg font-medium opacity-90 max-w-xl">
            Buy and sell academic books and college accessories with your peers.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="relative z-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-5 py-3 rounded-2xl font-bold border border-white/30 shadow-sm shrink-0 flex items-center gap-2 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" /> Sell an Item
        </button>
      </div>

      {/* Controls & Filters */}
      <div
        className={`flex flex-col sm:flex-row justify-between items-center gap-4 p-4 rounded-xl shadow-sm border transition-colors ${getCardThemeClasses(appTheme)}`}
      >
        <div className="bg-black/5 dark:bg-white/5 p-1 rounded-xl flex shadow-inner border border-inherit/30 w-full sm:w-auto">
          <button
            onClick={() => setActiveCategory("All")}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm transition-all ${activeCategory === "All" ? "bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
          >
            All Items
          </button>
          <button
            onClick={() => setActiveCategory("Books")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeCategory === "Books" ? "bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
          >
            <Book className="w-4 h-4" /> Books
          </button>
          <button
            onClick={() => setActiveCategory("Accessories")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeCategory === "Accessories" ? "bg-white text-black dark:bg-gray-700 dark:text-white shadow-sm" : "opacity-60 hover:opacity-100"}`}
          >
            <Watch className="w-4 h-4" /> Accessories
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 text-inherit" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/5 dark:bg-white/5 border border-inherit/30 rounded-lg text-sm text-inherit focus:outline-none focus:ring-2 focus:ring-current transition-colors"
          />
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No items found"
          description="There are currently no items listed in this category."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all flex flex-col group relative ${product.status === "Sold" ? "opacity-70 grayscale-[50%]" : ""}`}
            >
              <div className="relative h-48 bg-black/5 dark:bg-white/5 overflow-hidden">
                {product.images && product.images.length > 0 ? (
                  <div className="flex h-full w-full overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
                    {product.images.map((img, idx) => {
                      const imgPath =
                        typeof img === "string" ? img : img.path;
                      const safePath = imgPath ? imgPath.replace(/\\/g, "/") : "";
                      const src = safePath.startsWith("http")
                        ? safePath
                        : `/${safePath}`;
                      return (
                        <img
                          key={idx}
                          src={src}
                          alt={`${product.title} - ${idx + 1}`}
                          className="w-full h-full object-cover shrink-0 snap-center group-hover:scale-105 transition-transform duration-500"
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-30">
                    <ImageIcon className="w-16 h-16" />
                  </div>
                )}

                {product.images?.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white font-bold px-2 py-1 rounded-lg text-xs border border-white/20 z-10 pointer-events-none flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> {product.images.length}
                  </div>
                )}

                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white font-bold px-3 py-1 rounded-lg text-sm border border-white/20">
                  ₹{product.price}
                </div>
                <div className="absolute top-2 left-2 bg-white/90 dark:bg-black/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1">
                  {product.category === "Books" ? (
                    <Book className="w-3 h-3" />
                  ) : (
                    <Watch className="w-3 h-3" />
                  )}
                  {product.category}
                </div>
                {product.status !== "Available" && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
                    <span className="bg-red-600 text-white font-black px-4 py-2 rounded-lg tracking-widest uppercase shadow-xl transform -rotate-12 border-2 border-red-400">
                      {product.status}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1">
                <h3 className="font-bold text-lg leading-tight mb-2 text-inherit line-clamp-2">
                  {product.title}
                </h3>
                <p className="text-sm opacity-80 mb-4 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-4 mt-auto">
                  <span className="flex items-center gap-1 bg-black/5 dark:bg-white/5 border border-inherit/20 px-2 py-1 rounded text-xs font-semibold">
                    <Tag className="w-3 h-3" /> {product.condition}
                  </span>
                  {product.location && (
                    <span className="flex items-center gap-1 bg-black/5 dark:bg-white/5 border border-inherit/20 px-2 py-1 rounded text-xs font-semibold">
                      <MapPin className="w-3 h-3" /> {product.location}
                    </span>
                  )}
                  {product.deliveryOptions?.includes("Home Delivery") ? (
                    <span className="flex items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 px-2 py-1 rounded text-xs font-bold">
                      <Truck className="w-3 h-3" /> Delivery Available
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs font-bold">
                      <Package className="w-3 h-3" /> Pickup Only
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-inherit/20 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <UserInfo
                      user={product.seller}
                      avatarSize="w-8 h-8"
                      showText={false}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold truncate max-w-[100px]">
                        {product.seller?.name || "Unknown Seller"}
                      </span>
                      <span className="text-[10px] opacity-70">Seller</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(user?._id === product.seller?._id ||
                      user?.role === "Admin") && (
                      <>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit Listing"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {user?._id !== product.seller?._id && (
                      <button
                        onClick={() =>
                          navigate(
                            `/chat?userId=${product.seller?._id || ""}&text=${encodeURIComponent(`Hi! I'm interested in your listing: "${product.title}" for ₹${product.price}. Is it still available?`)}`,
                          )
                        }
                        disabled={!product.seller?._id}
                        className={`p-2 rounded-lg transition-colors shadow-sm ${getPrimaryButtonClasses(appTheme)}`}
                        title="Message Seller"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div
              className={`${getCardThemeClasses(appTheme)} rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200`}
            >
              <div className="p-4 border-b border-inherit/30 flex justify-between items-center bg-black/5 dark:bg-white/5 shrink-0">
                <h3 className="font-bold text-lg text-inherit flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />{" "}
                  {editingProductId ? "Edit Item" : "List an Item"}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors opacity-70 hover:opacity-100"
                >
                  <X className="w-5 h-5 text-inherit" />
                </button>
              </div>
              <form
                onSubmit={handlePostProduct}
                className="p-6 overflow-y-auto flex flex-col gap-4 flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full"
              >
                {/* Multiple Images Upload */}
                <div className="w-full min-h-40 bg-black/5 dark:bg-white/5 border-2 border-dashed border-inherit/30 rounded-xl relative group overflow-hidden flex flex-col items-center justify-center p-4">
                  {previewImages.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto w-full max-w-full snap-x pb-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                      {previewImages.map((img, i) => (
                        <div key={i} className="relative snap-center shrink-0">
                          <img
                            src={img.url}
                            alt="Preview"
                            className="h-28 w-28 object-cover rounded-lg border border-inherit/30"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImages((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center opacity-60 py-6 pointer-events-none">
                      <Camera className="w-8 h-8 mb-2" />
                      <span className="text-sm font-bold">
                        Add Product Photos (Up to 5)
                      </span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const totalAllowed = 5 - previewImages.length;
                        const filesToAdd = Array.from(e.target.files).slice(
                          0,
                          totalAllowed,
                        );
                        setPreviewImages([
                          ...previewImages,
                          ...filesToAdd.map((f) => ({
                            url: URL.createObjectURL(f),
                            isRetained: false,
                            file: f,
                          })),
                        ]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold opacity-90 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.title}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, title: e.target.value })
                    }
                    placeholder="e.g. Engineering Physics Textbook"
                    className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold opacity-90 mb-1">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newProduct.price}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, price: e.target.value })
                      }
                      placeholder="e.g. 500"
                      className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold opacity-90 mb-1">
                      Category
                    </label>
                    <select
                      value={newProduct.category}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          category: e.target.value,
                        })
                      }
                      className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                    >
                      <option
                        value="Books"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Books
                      </option>
                      <option
                        value="Accessories"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Accessories
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold opacity-90 mb-1">
                      Condition
                    </label>
                    <select
                      value={newProduct.condition}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          condition: e.target.value,
                        })
                      }
                      className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                    >
                      <option
                        value="New"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        New
                      </option>
                      <option
                        value="Like New"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Like New
                      </option>
                      <option
                        value="Good"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Good
                      </option>
                      <option
                        value="Fair"
                        className={getOptionClasses(appTheme, isDark)}
                      >
                        Fair
                      </option>
                    </select>
                  </div>
                  {editingProductId && (
                    <div>
                      <label className="block text-sm font-bold opacity-90 mb-1">
                        Status
                      </label>
                      <select
                        value={newProduct.status}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            status: e.target.value,
                          })
                        }
                        className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                      >
                        <option
                          value="Available"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Available
                        </option>
                        <option
                          value="Reserved"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Reserved
                        </option>
                        <option
                          value="Sold"
                          className={getOptionClasses(appTheme, isDark)}
                        >
                          Sold
                        </option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold opacity-90 mb-1">
                      Location on Campus
                    </label>
                    <input
                      type="text"
                      value={newProduct.location}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          location: e.target.value,
                        })
                      }
                      placeholder="e.g. Main Library"
                      className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none"
                    />
                  </div>
                </div>

                {/* Delivery Options */}
                <div>
                  <label className="block text-sm font-bold opacity-90 mb-2">
                    Delivery Options
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {["Pickup", "Campus Delivery", "Home Delivery"].map(
                      (opt) => (
                        <label
                          key={opt}
                          className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                            newProduct.deliveryOptions.includes(opt)
                              ? "bg-blue-500/10 border-blue-500 shadow-sm"
                              : "bg-black/5 dark:bg-white/5 border-inherit/30 hover:border-inherit/50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={newProduct.deliveryOptions.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProduct((prev) => ({
                                  ...prev,
                                  deliveryOptions: [
                                    ...prev.deliveryOptions,
                                    opt,
                                  ],
                                }));
                              } else {
                                setNewProduct((prev) => ({
                                  ...prev,
                                  deliveryOptions:
                                    prev.deliveryOptions.filter(
                                      (o) => o !== opt,
                                    ).length === 0
                                      ? ["Pickup"] // Ensure at least one option remains
                                      : prev.deliveryOptions.filter(
                                          (o) => o !== opt,
                                        ),
                                }));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-bold text-inherit">
                            {opt}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold opacity-90 mb-1">
                    Description
                  </label>
                  <textarea
                    required
                    rows="3"
                    value={newProduct.description}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe the item's condition and details..."
                    className="w-full p-2.5 rounded-lg border border-inherit/30 bg-black/5 dark:bg-white/5 text-inherit focus:ring-2 focus:ring-current outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-inherit/30">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 font-bold opacity-70 hover:opacity-100 transition-opacity"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPosting}
                    className={`px-6 py-2 rounded-lg font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2 ${getPrimaryButtonClasses(appTheme)}`}
                  >
                    {isPosting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>{" "}
                        {editingProductId ? "Saving..." : "Listing..."}
                      </>
                    ) : editingProductId ? (
                      "Save Changes"
                    ) : (
                      "List Product"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default Marketplace;
