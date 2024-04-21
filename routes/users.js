import express from 'express';
import { createUser, loginUser, logoutUser, checkAuth, saveRecipe } from '../controllers/userController.js';

const router = express.Router();

router.post("/register", createUser)

router.post("/login", loginUser)

router.post("/test", checkAuth)

router.post("/check-tokens", checkAuth)

router.post("/save", checkAuth, saveRecipe)

router.delete("/logout", logoutUser)




export { router };