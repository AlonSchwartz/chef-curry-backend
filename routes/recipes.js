import express from 'express';
import { checkAuth } from '../controllers/userController.js';
import { addToFavorites, getRecipe } from '../controllers/recipeController.js';
import { createRecipe } from '../controllers/recipeController.js'

const router = express.Router();

router.post("/", createRecipe)

router.post("/save", checkAuth, addToFavorites)

router.get("/:id", getRecipe)

export { router };