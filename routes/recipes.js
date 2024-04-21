import express from 'express';
import { loginUser, logoutUser, checkAuth } from '../controllers/userController.js';
import { addToFavorites, getAllRecipes, createHashValue, getRecipe } from '../controllers/recipeController.js';
import { createRecipe } from '../controllers/recipeController.js'

const router = express.Router();

//router.get("/urlCheck", hashId)

router.post("/", createRecipe)

//router.post("/login", loginUser)

//router.post("/test", checkAuth)

//router.post("/check-tokens", checkAuth, checkTokens)

router.post("/save", checkAuth, addToFavorites)

//router.get("/recipes", checkAuth, getAllRecipes)

//router.post("/share", shareRecipe)

router.get("/:id", getRecipe)

//router.delete("/logout", logoutUser)





export { router };