import bcrypt from "bcrypt";
import { pool } from './databaseConnection.js';

/**
 * Creates a new user in database.
 * 
 * This function is being called only after a check if the email address is already registered.
 * 
 * Therefore, in case of an error, it means that the database is not available.
 * @param {*} email the email of the user
 * @param {*} password the hashed password of the user
 * @returns the id of the new user
 */
export async function createUserInDB(email, password) {
    try {
        const result = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
            [email, password]
        );

        const id = result.rows[0].id;
        return id;
    } catch (error) {
        console.log(error)
        throw new Error("Database not available :(")
    }
}

/**
 * Performing login to the system.
 * 
 * comparing the given email and hashed password with the stored ones.
 * @param {*} email the email of the user
 * @param {*} password the hashed password
 * @returns boolean indicates if the user is logged in or not
 */
export async function login(email, password) {
    const user = await getUserFromDB(email);
    try {
        if (await bcrypt.compare(password, user.password)) {
            console.log("Password Match!")
            return true;
        }
        else {
            console.log("Password does not match!")
            return false;
        }
    } catch (error) {
        console.log(error)
        throw new Error("login failed due to internal error.")
    }
}

/**
 * Checking if a given email address is already registered
 * @param {*} email the email to check
 * @returns boolean indicates the answer
 */
export async function checkIfEmailExists(email) {
    try {
        const queryResult = await pool.query(
            'SELECT COUNT(1) FROM users WHERE email = $1',
            [email]
        );
        const emailCount = queryResult.rows[0].count;

        return emailCount === '0' ? false : true;
    } catch (error) {
        console.log(error)
        throw new Error("Database not available :(")
    }
}

/**
 * Turns a given password into hash value.
 * @param {*} password the password to hash 
 * @returns the hashed password
 */
export async function hashPassword(password) {
    try {
        const salt = await bcrypt.genSalt()
        const hashedPassword = await bcrypt.hash(password, salt)
        return hashedPassword;
    } catch (error) {
        console.log(error)
        throw new Error("Internal error")
    }
}

/**
 * Gets user's basic data from DB
 * @param {*} email the email of the user
 * @returns user object
 */
async function getUserFromDB(email) {
    try {
        const result = await pool.query(`
        SELECT *
        FROM users
        WHERE email = $1
      `, [email]);

        return result.rows[0];
    } catch (error) {
        console.log(error)
        throw new Error("Database not available :(")
    }
}

/**
 * Stores a secret that is used for JWT / JWT refreshToken in the database.
 * @param {*} email the email of the user
 * @param {*} token the secret
 * @param {*} isRefresh is it a used for refresh token or not
 * @returns a boolean that indicates if the secret was stored or not
 */
export async function storeSecret(email, token, isRefresh) {

    let tableName = isRefresh ? "refresh_tokens" : "tokens";

    try {
        const result = await pool.query(`
        INSERT INTO ${tableName} (email, token)
        VALUES ($1, $2)
      `, [email, token]);
        return result.rowCount > 0;
    } catch (error) {
        console.log(error)
        return false;
    }
}

/**
 * Gets a user secret from DB
 * @param {*} email the email address of the user
 * @returns user's secret
 */
export async function getSecret(email) {
    try {

        const result = await pool.query(`
        SELECT token
        FROM tokens
        WHERE email = $1
      `, [email]);

        return result.rows[0] ? result.rows[0].token : null;
    } catch (error) {
        console.log(error)
    }
}

/**
 * Gets a user refresh secret from DB
 * @param {*} email the email address of the user
 * @returns user's refresh secret
 */
export async function getRefreshSecret(email) {
    try {
        const result = await pool.query(`
        SELECT token
        FROM refresh_tokens
        WHERE email = $1
      `, [email]);

        return result.rows[0] ? result.rows[0].token : null;
    } catch (error) {
        console.log(error)
    }
}
/**
 * Deletes a user from database
 * @param {*} email the email of the user to delete
 * @returns true if the deletion was successful, or error otherwise
 */
export async function deleteUserFromDB(email) {
    try {
        const result = await pool.query(`
        DELETE FROM users
        WHERE email = $1
        `, [email]);

        return true;
    } catch (error) {
        console.log(error)
    }
}

/**
 * Updates the stored secret with a new one.
 * 
 * Currently its not in use
 * @param {*} email the email of the user
 * @param {*} secret the new secret 
 * @returns 
 */
export async function updateSecret(email, secret) {
    let tableName = "tokens";

    try {
        const result = await pool.query(`
        UPDATE ${tableName}
        SET token = $1 
        WHERE email = $2
      `, [secret, email]);

        return result.rowCount > 0;
    } catch (error) {
        console.log(error)
        return false;
    }
}