import { pool } from './databaseConnection.js';

/**
 * Saves a given recipe into the database
 * @param {*} recipe the recipe to save
 * @returns the id of the saved recipe, or false if save proccess failed
 */
export async function saveRecipeInDB(recipe) {
    try {
        const result = await pool.query(`
        INSERT INTO recipes
        (date, "shareableHash", name, description, ingredients, instructions)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `, [recipe.date, recipe.shareableHash, recipe.name, recipe.description, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions)]);
        return result.rows[0].id;
    } catch (error) {
        console.log(error)
        if (error.code === "23505") { //PostgreSQL error code for duplicate item
            console.log("Hash already exists")
            return false;
        }
        else {
            throw new Error(error)
        }
    }
}

/**
 * Adds a recipe to user's favorite recipes list.
 * @param {*} userId the user that the recipe list belongs to
 * @param {*} recipeId the recipe to add to favorites
 * @returns the id of the recipe in favorites
 */
export async function favoriteRecipeInDB(userId, recipeId) {
    try {
        const result = await pool.query(`
      INSERT INTO favorite_recipes
      (userId, recipeId)
      VALUES ($1, $2)
      RETURNING id;
    `, [userId, recipeId]);
        console.log(result.rows[0])

        return result.rows[0].id;
    } catch (error) {
        console.log(error)
    }

}

/**
 * Gets all favorite recipes from user's favorites list
 * @param {*} email the email of the user
 * @returns array with favorite recipes
 */
export async function getRecipesFromDB(email) {
    try {
        const userId = await getUserId(email)
        const recipeIds = await getFavoriteRecipesIds(userId)

        const { rows: recipes } = await pool.query(
            `SELECT * 
            FROM recipes
            WHERE id = ANY($1)`,
            [recipeIds]
        );

        return recipes;

    } catch (error) {
        console.log(error)
        throw new Error("Get recipes data failed")
    }
}

/**
 * Internal function to get a user's favorite recipes IDs
 * @param {*} userId the id of the user that we get his favorite recipes
 * @returns array with recipes ids
 */
async function getFavoriteRecipesIds(userId) {
    const { rows: recipeObjectIds } = await pool.query(`
    SELECT recipeId
    FROM favorite_recipes
    WHERE userId = $1;
  `, [userId]);
    const recipeIds = recipeObjectIds.map(obj => obj.recipeid); //recipeId
    return recipeIds;
}

/**
 * Gets a user id by email address
 * @param {*} email the email address of the user
 * @returns users id
 */
export async function getUserId(email) {
    try {
        const { rows: user } = await pool.query(`
        SELECT id
        FROM users
        WHERE email = $1;
      `, [email]);

        return user[0].id;
    } catch (error) {
        console.log(error)
    }
}

/**
 * Gets all user's favorite recipes by user id
 * @param {*} userId the id of the user
 * @returns array of favorite recipes
 */
export async function getFavoriteRecipesBy_userId(userId) { // Need to decide if using this function or doing it in different way.
    try {
        const { rows: recipes } = await pool.query(`
        SELECT recipes.* 
        FROM favorite_recipes
        JOIN recipes ON favorite_recipes.recipeId = recipes.id
        WHERE favorite_recipes.userId = $1;
      `, [userId]);

        return recipes;
    } catch (error) {
        console.log(error)
    }
}

/**
 * Gets a recipe by it's Hash value
 * @param {*} hash the hash value
 * @returns recipe object
 */
export async function getRecipeByHash(hash) {
    try {
        const { rows: recipe } = await pool.query(`
        SELECT *
        FROM recipes
        WHERE "shareableHash" = $1;
      `, [hash]);

        return recipe[0];
    } catch (error) {
        console.log(error)
    }
}