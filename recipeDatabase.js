import { pool } from './database.js';

export async function saveRecipeInDB(recipe) {
    // console.log("===========================================================================")
    console.log("In save recipe method")
    try {
        console.log("Trying to save")
        const result = await pool.query(`
        INSERT INTO recipes
        (date, "shareableHash", name, description, ingredients, instructions)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `, [recipe.date, recipe.shareableHash, recipe.name, recipe.description, JSON.stringify(recipe.ingredients), JSON.stringify(recipe.instructions)]);
        console.log(result)
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

export async function getRecipesFromDB(email) {
    try {
        const userId = await getUserId(email)
        console.log("User id is: " + userId)

        const { rows: recipeObjectIds } = await pool.query(`
        SELECT recipeId
        FROM favorite_recipes
        WHERE userId = $1;
      `, [userId]);

        console.log(recipeObjectIds)

        const recipeIds = recipeObjectIds.map(obj => obj.recipeid); //recipeId
        console.log(recipeIds)

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


export async function getRecipesFromDB2(userId) {
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

export async function getRecipeByHash(hash) {
    try {

        console.log("Trying...")
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

//Not in use. 
export async function getRecipeHash(recipeId) {
    console.log("Going to get hash to recipe id = " + recipeId)
    try {

        const { rows: recipeHashObj } = await pool.query(`
        SELECT shareableHash
        FROM shared_recipes
        WHERE recipeId = $1;
      `, [recipeId]);

        console.log('This is the hash I found: ' + recipeHashObj[0].shareableHash);
        return recipeHashObj[0].shareableHash;
    } catch (error) {

    }
}
/** BACKUP functions for now. maybe will be used after the project will be deployed. I have to test response times first */

/*
export async function shareRecipe(req, res) {
    const recipeId = req.body.recipeId;
    console.log("recipe id is " + recipeId)
    try {
        const [recipeHash] = await pool.query(`
    SELECT * 
FROM shared_recipes
WHERE recipeId = ?;
    `, [recipeId])
        console.log(recipeHash)

        if (recipeHash.length > 0) {
            return recipeHash
        }
        else {
            let a = "This Meatball Curry features aajuicy beef meatballs cooked in a flavorful blend of spices and tomatoes. The curry sauce is aromatic and pairs perfectly with the tender meatballs. It's a satisfying and comforting dish that will be enjoyed by meatball and curry lovers alike!"
            let hash = crypto.createHash('sha256').update(a).digest('hex').slice(0, 16);

            const [recipeHash] = await pool.query(`
            INSERT INTO shared_recipes
            (recipeId, shareableHash)
            VALUES (?, ?)
            `, [recipeId, hash])
            return hash;
        }

    } catch (error) {
        console.log(error)
    }

}

export async function saveRecipeHash(recipeId, hash) {
    console.log("Going to try to save the hash in DB. recipeId = " + recipeId + " hash = " + hash)
    try {
        const [recipeHash] = await pool.query(`
        INSERT INTO shared_recipes
        (recipeId, shareableHash)
        VALUES (?, ?)
        `, [recipeId, hash])
        console.log("This is what i got after saving: " + recipeHash)
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            console.log("Hash already exists")
        }
        else if (error.code === "ER_NO_REFERENCED_ROW_2") {
            console.log("recipe id doesnt exists")
        }
        else {
            console.log(error)
        }
    }
}*/
