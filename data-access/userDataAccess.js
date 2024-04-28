import { config } from 'dotenv'
import bcrypt from "bcrypt";
import pkg from 'pg';
const { Pool } = pkg;

config()

export { pool };

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        require: true,
    },
});


export async function createUserInDB(email, password) {
    //In case this email address is not registered
    try {

        console.log("Trying to actualy add the user")

        const result = await pool.query(
            'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
            [email, password]
        );

        const id = result.rows[0].id;
        console.log(id);
        console.log("User created successfully!");
        return id;
    } catch (error) {
        console.log(error)
        //At this point, the email address and password has already been verified. therefore, the only reason for an error can be that the database is not available
        throw new Error("Database not available :(")
    }
}

export async function login(email, password) {
    //  console.log("I am in the database function, with the email: " + email )
    const user = await getUserFromDB(email);
    console.log("this is the user")
    console.log(user)
    console.log(password)
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

export async function deleteSecrets(email) {
    try {
        const user = await pool.query(`
        DELETE FROM refresh_tokens
        WHERE email = $1 AND id IN (
          SELECT id FROM tokens WHERE email = $1
        )
      `, [email, email]);

        return true;
    } catch (error) {
        console.log(error)
        return false;
    }
}

export async function checkIfEmailExists(email) {
    try {
        console.log("EMAIL IS " + email)
        console.log("I am in check email method!")

        const queryResult = await pool.query(
            'SELECT COUNT(1) FROM users WHERE email = $1',
            [email]
        );

        console.log("Finished the search. I found: ");
        console.log(queryResult.rows[0]);

        const emailCount = queryResult.rows[0].count;


        return emailCount === '0' ? false : true;
    } catch (error) {
        console.log(error)
        throw new Error("Database not available :(")
    }
}

export async function hashPassword(password) {
    try {
        console.log("Going to try create a salt. the password is " + password)
        const salt = await bcrypt.genSalt()
        console.log("Salt is " + salt)
        const hashedPassword = await bcrypt.hash(password, salt)
        return hashedPassword;
    } catch (error) {
        console.log(error)
        throw new Error("Internal error")
    }
}

async function getUserFromDB(email) {
    try {
        console.log("in getUserFromDB method.")
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
        console.log("row count is: " + result.rowCount)
        return result.rowCount > 0;
    } catch (error) {
        console.log(error)
        return false;
    }
}

export async function updateSecret(email, token) {

    let tableName = "tokens";

    try {
        const result = await pool.query(`
        UPDATE ${tableName}
        SET token = $1 
        WHERE email = $2
      `, [token, email]);

        return result.rowCount > 0;
    } catch (error) {
        console.log(error)
        return false;
    }
}

export async function getSecret(email) {
    try {

        const result = await pool.query(`
        SELECT token
        FROM tokens
        WHERE email = $1
      `, [email]);
        // console.log("Token:")
        // console.log(result.rows)

        return result.rows[0] ? result.rows[0].token : null;
    } catch (error) {
        console.log(error)
    }
}

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
        // return [];  // maybe i should remove it
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

