import Product from "../models/Product.js";
import User from "../models/User.js";
import { processUpload, deleteMediaDocs, normalizeArr } from "../utils/mediaHelper.js";
import fs from "fs/promises";
import path from "path";
import Media from "../models/Media.js";
import { ok, created, notFound, forbidden, badRequest, serverError } from "../utils/index.js";

export const getProducts = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;
    const filter = {};

    if (req.query.category) filter.category = req.query.category;
    if (req.query.status)   filter.status   = req.query.status;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("seller", "name profilePicture role department")
        .populate({ path: "images", model: "Media" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    ok(res, { products, total, page, pages: Math.ceil(total / limit) }, "Products retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("seller", "name profilePicture role department")
      .populate({ path: "images", model: "Media" });
      
    if (!product) return notFound(res, "Product not found.");
    ok(res, product, "Product retrieved successfully.");
  } catch (error) {
    serverError(res);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { title, price, category, condition, location, description } = req.body;
    const deliveryOptions = normalizeArr(req.body.deliveryOptions);

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return badRequest(res, 'Price must be a positive number');
    }
    if (!title || String(title).trim().length < 2) {
      return badRequest(res, 'Title must be at least 2 characters');
    }
    
    // Sanitize text fields
    const safeTitle = String(title).trim().slice(0, 200);
    const safeLocation = location ? String(location).trim().slice(0, 200) : '';
    const safeCondition = String(condition).trim();

    let mediaIds = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const media = await processUpload(file, "marketplace");
        mediaIds.push(media._id);
      }
    }

    const product = await Product.create({
      title: safeTitle,
      price: parsedPrice,
      category,
      condition: safeCondition,
      location: safeLocation,
      description: description ? String(description).trim() : '',
      deliveryOptions: deliveryOptions.length > 0 ? deliveryOptions : ["Pickup"],
      seller: req.user._id,
      images: mediaIds,
    });

    const populatedProduct = await Product.findById(product._id)
      .populate("seller", "name profilePicture role department")
      .populate({ path: "images", model: "Media" });
    created(res, populatedProduct, "Product created successfully.");
  } catch (error) {
    serverError(res);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const { title, price, category, condition, location, status, description } = req.body;
    console.log("Update Product Request Body:", req.body);
    const deliveryOptions = normalizeArr(req.body.deliveryOptions);
    const product = await Product.findById(req.params.id);
console.log("Found Product:", product);
    if (!product) return notFound(res, "Product not found.");
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "Admin") {
      return forbidden(res, "Not authorized to update this product.");
    }

    if (title) {
      if (String(title).trim().length < 2) {
        return badRequest(res, 'Title must be at least 2 characters');
      }
      product.title = String(title).trim().slice(0, 200);
    }
    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p <= 0) return badRequest(res, 'Price must be a positive number');
      product.price = p;
    }
    if (category) product.category = category;
    if (condition) product.condition = String(condition).trim();
    if (location !== undefined) product.location = String(location).trim().slice(0, 200);
    if (description !== undefined) product.description = String(description).trim();
    if (status) product.status = status;
    if (req.body.deliveryOptions) product.deliveryOptions = deliveryOptions;

    if (req.body.retainedMediaIds !== undefined || (req.files && req.files.length > 0)) {
      let retainedIds = [];
      if (req.body.retainedMediaIds === "[]") {
        retainedIds = [];
      } else if (req.body.retainedMediaIds) {
        retainedIds = Array.isArray(req.body.retainedMediaIds) ? req.body.retainedMediaIds : [req.body.retainedMediaIds];
      }
      const orphanedDocs = [];

      if (product.images && product.images.length > 0) {
        const existingMedia = await Media.find({ _id: { $in: product.images } });
        for (const mDoc of existingMedia) {
          if (!retainedIds.includes(mDoc._id.toString())) orphanedDocs.push(mDoc);
        }
      }
      await deleteMediaDocs(orphanedDocs.map((o) => o._id));

      const newMediaIds = [...retainedIds];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const f = req.files[i];
          const m = await processUpload(f, "marketplace");
          newMediaIds.push(m._id);
        }
      }
      product.images = newMediaIds;
    }

    await product.save();
    const populatedProduct = await Product.findById(product._id)
      .populate("seller", "name profilePicture role department")
      .populate({ path: "images", model: "Media" });
    ok(res, populatedProduct, "Product updated successfully.");
  } catch (error) {
    serverError(res);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const sellerUser = await User.findById(req.user._id).select('status');
    if (sellerUser?.status === 'Blocked') return forbidden(res, 'Account suspended');

    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, "Product not found.");
    if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "Admin") return forbidden(res, "Not authorized to delete this product.");
    
    if (product.images && product.images.length > 0) {
      await deleteMediaDocs(product.images);
    }

    await product.deleteOne();
    ok(res, null, "Product deleted successfully.");
  } catch (error) {
    serverError(res);
  }
};