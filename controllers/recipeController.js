import { OpenAI } from "openai";
import { saveRecipeInDB, getRecipesFromDB, favoriteRecipeInDB, getUserId, getRecipeByHash } from "../data-access/recipeDataAccess.js";
import crypto from "crypto"
import fs from 'fs';
import { sendEmail } from '../utils/emailService.js'

//In localhost, contacting openai fails because the request is not being sent with tls.
//this is a workaround to bypass it FOR DEVELOPMENT ONLY.
if (process.env.DEVELOPMENT === 'true') {
    console.warn("Local development mode: TLS IS OFF")
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY
})

export async function createRecipe(req, res) {

    const recipePrompt = createPrompt(req, res)

    if (!recipePrompt) {
        console.log("Bad request.")
        return res.status(400).json({ message: "missing data." });
    }

    try {

        let recipeResponse = await contactOpenAI(recipePrompt)
        let recipe = await processRecipe(recipeResponse)
        let savedRecipe = await saveRecipe(recipe)

        return res.json(savedRecipe)

    } catch (error) {
        console.log(error)

        sendEmail(error);
        return res.status(500).json({ success: false, message: "Internal server error, or connection error." });
    }

}

/**
 * Creates a recipe prompt based on user request
 * @returns the recipe prompt
 */
function createPrompt(req, res) {
    const promptObject = getPromptObject(req, res)

    const ingredients = req.body.ingredients;
    const withAdditionalIngredients = req.body.withAdditionalIngredients

    let recipePrompt = promptObject.prefix;

    if (ingredients && ingredients.length > 0) {
        ingredients.forEach((ingredient, index, array) => {
            if (index === array.length - 1) {
                recipePrompt += ingredient + ". " //we are at the last element
            } else {
                recipePrompt += ingredient + ", "
            }
        });

    }
    else {
        //return null, because there are no ingredients
        return null;
    }

    // In case the user asked to that the recipe will be without additional ingredients
    if (!withAdditionalIngredients) {
        recipePrompt += promptObject.without_additional_ingredients
    }

    recipePrompt += promptObject.content

    return recipePrompt;
}


/**
 * Contacts Open AI servers with a prompt
 * @param recipePrompt the prompt to send to Open AI servers
 * @returns Open AI response as a string
 * @throws {Error} In case that the connection to OpenAI was stopped without getting a full response
 */
async function contactOpenAI(recipePrompt) {
    const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-1106",
        max_tokens: 1000,
        response_format: { "type": "json_object" },
        messages: [{ role: 'user', content: recipePrompt }]
    })

    if (chatResponse.choices[0].finish_reason == "stop") {

        let recipe = chatResponse.choices[0].message.content

        recipe = recipe.trim();

        return recipe;
    }
    else {
        console.log(chatResponse.choices[0])
        throw new Error("Finished due to reason that is not STOP: " + chatResponse.choices[0].finish_reason)
    }
}

/**
 * Checks if the recipe structure is valid, and adds new fields to it
 * @param {*} recipeString the recipe
 * @returns validated recipe
 */
async function processRecipe(recipeString) {

    // There is an extreme case where chatgpt returns an answer without curly parentheses
    if (recipeString.charAt(recipeString.length - 1) !== '}') {
        console.log("====I am adding { } ======")
        recipeString = "{" + recipeString + "}"
    }

    let recipe = JSON.parse(recipeString)
    recipe.date = new Date().toLocaleDateString();

    let hash = await createHashValue(recipe.description)
    recipe.shareableHash = hash;

    const isInstructionsArray = Array.isArray(recipe.instructions);
    const isIngredientsArray = Array.isArray(recipe.ingredients);

    //There are some extreme cases where chatgpt returns bad structure of the instructions/ ingredients array
    if (!isInstructionsArray || !isIngredientsArray) {

        const error = {
            'name': 'Invalid structure',
            'message': 'Recipe object have invalid structure',
            'stack': JSON.stringify(recipe)
        }

        sendEmail(error)

        if (!isInstructionsArray) {
            console.log("Instructions is not an array")
            recipe.instruction = await flattenObjectValues(recipe.instructions)
        }
        if (!isIngredientsArray) {
            console.log("Ingredients is not an array")
            recipe.ingredients = await flattenObjectValues(recipe.ingredients)
        }

    }
    else {
        console.log("Structure is good")
    }

    return recipe;
}

/**
 * Saves the provided recipe object to the database.
 * If a recipe with the same hash already exists in the database, generates a new hash and retries the save operation.
 * 
 * @param {*} recipe The recipe object to be saved to the database.
 * @returns The saved recipe object with an assigned ID.
 * @throws {Error} If unable to save the recipe due to database errors or failure to generate a unique hash.

 */
async function saveRecipe(recipe) {
    let recipeId = await saveRecipeInDB(recipe);

    // In case the hash is already exists - create a new hash
    if (!recipeId) {
        const newHash = await createHashValue(recipe.description + recipe.name)
        recipe.shareableHash = newHash;

        let newRecipeId = await saveRecipeInDB(recipe)
        if (!newRecipeId) {
            throw new Error("Hash value already exists. Failed creating a new, unique one.")
        }
        else {
            recipeId = newRecipeId
        }
    }
    recipe.id = recipeId;

    return recipe;
}


/**
 * Adds a recipe to user favorites
 * @returns server response to the client, indicating if recipe was added to favorites or not
 */
export async function addToFavorites(req, res, next) {

    const recipeId = req.body.recipeId;
    const email = req.body.email;

    if (!recipeId || !email) {
        return res.status(400).json({ message: "missing data." });
    }

    try {
        const userId = await getUserId(email)
        const favorite = await favoriteRecipeInDB(userId, recipeId)

        return res.json({ msg: "i saved it and All good", id: favorite });

    } catch (error) {
        console.log("Adding to favorites failed.")
        console.log(error)

        sendEmail(error)

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * Generates a hash that is 16 characters long, based on recipe description
 * @param {*} recipeDescription A string representing a recipe.
 * @returns The hash value.
 */
export async function createHashValue(recipeDescription) {
    try {
        let link = crypto.createHash('sha256').update(recipeDescription).digest('hex').slice(0, 16);
        return link;
    } catch (error) {
        console.log(error)
        throw new Error("Internal error")
    }
}

/**
 * Retrieves a recipe based on the provided hash identifier, which is extracted from the request parameters.
 * @returns The recipe object
 */
export async function getRecipe(req, res) {
    console.log("===== VIEWING RECIPE =====")
    console.log(req.params.id)
    let hash = req.params.id;
    try {
        let recipe = await getRecipeByHash(hash);
        console.log(recipe)
        return res.json({ recipe: recipe })
    } catch (error) {
        console.log("Get recipe failed.")
        console.log(error)
        sendEmail(error)

        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

/**
 * Flattens the values of a nested object into a single array.
 * @param {*} obj The nested object 
 * @returns An array containing all values extracted from the object
 */
async function flattenObjectValues(obj) {
    const result = [];

    if (obj) {
        Object.values(obj).forEach(value => {
            console.log(value)

            result.push(value)
        })

        console.log("Result:")
        console.log(result)

        return result;
    }
}

/**
 * Gets the prompt object from a server secret
 * @returns prompt object
 */
function getPromptObject() {
    const isDevelopment = process.env.DEVELOPMENT === 'true';

    let content_path = ''
    if (isDevelopment) {
        content_path = 'prompt_content.txt'
    }
    else {
        content_path = 'prompt_content'
    }

    const content = fs.readFileSync(content_path, 'utf-8');
    const prefixStr = fs.readFileSync('prompt_prefix', 'utf-8');

    const prefixObj = JSON.parse(prefixStr)

    let promptObject = {
        prefix: prefixObj.starting_line,
        without_additional_ingredients: prefixObj.without_additional_ingredients,
        content: content
    }

    return promptObject;
}


/**
 * Gets all the recipes that were created by a certain user
 * @returns server response with an array which contains the recipes
 */
export async function getAllRecipes(req, res, next) { //NOT IN USE FOR NOW
    try {
        const email = req.body.email;
        const userId = await getUserId(email)

        let recipes = await getRecipesFromDB(userId)

        console.log(recipes)
        return res.json({ msg: "Data fetched successfully", recipes: recipes })
    } catch (error) {
        console.error(error)
        sendEmail(error)
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}