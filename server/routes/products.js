import express from "express";
import { param, body } from "express-validator";
import { getProducts, getProductById, createProduct, deleteProduct, updateProduct } from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";
import { validateRequest } from "../middleware/validateMiddleware.js";

const router = express.Router();

/**
 * Reusable Validation Rules
 */
const productIdValidation = [param("id").isMongoId().withMessage("Invalid Product ID format")];

const productValidationRules = [
  body("title").optional().isString().trim().notEmpty().withMessage("Title is required"),
  body("price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Price must be a positive number"),
  body("category")
    .optional()
    .isIn(["Books", "Accessories"])
    .withMessage("Category must be Books or Accessories"),
  body("condition")
    .optional()
    .notEmpty()
    .withMessage("Condition cannot be empty"),
];

/**
 * GET Routes - Retrieve Products
 */

/**
 * @route   GET /api/products
 * @desc    Get all products
 * @access  Private
 */
router.get("/", protect, getProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get a specific product by ID
 * @access  Private
 */
router.get("/:id", protect, productIdValidation, validateRequest, getProductById);

/**
 * POST Routes - Create Products
 */

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (All roles)
 */
router.post(
  "/",
  protect,
  upload.array("images", 5),
  productValidationRules,
  validateRequest,
  createProduct
);

/**
 * PUT Routes - Update Products
 */

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private (All roles)
 */
router.put(
  "/:id",
  protect,
  upload.array("images", 5),
  [...productIdValidation, ...productValidationRules],
  validateRequest,
  updateProduct
);

/**
 * DELETE Routes - Remove Products
 */

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private (All roles)
 */
router.delete("/:id", protect, productIdValidation, validateRequest, deleteProduct);

export default router;