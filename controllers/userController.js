import { serialize } from 'cookie';
import { createUserInDB, checkIfEmailExists, login, hashPassword, getSecret, getRefreshSecret, updateSecret, storeSecret, deleteUserFromDB } from '../database.js';
import { getRecipesFromDB } from "../recipeDatabase.js";
import { sendEmail } from '../emailService.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken'

/**Create a user in the databse, in case the user doesnt exists */
export async function createUser(req, res) {
    const email = req.body.email;
    const password = req.body.password;

    try {
        const isEmailExists = await checkIfEmailExists(email);

        if (!isEmailExists) {
            const hashedPassword = await hashPassword(password);
            const userID = await createUserInDB(email, hashedPassword);
            const secret = await generateKey(email, false);
            const refreshSecret = await generateKey(email, true);

            const user = { email: email }
            const secrets = {
                secret: secret,
                refreshSecret: refreshSecret
            }

            const tokens = await generateTokens(email, secrets)
            const accessToken = tokens.accessToken;
            const refreshToken = tokens.refreshToken;

            const msg = {
                title: "User created successfully",
                userId: userID,
                succussfull: true
            }
            req.user = user;

            const jwtCookie = createCookie('jwtToken', accessToken)
            const refreshCookie = createCookie('refreshToken', refreshToken)

            res.setHeader('Set-Cookie', [jwtCookie, refreshCookie])
            res.json(msg)
        }
        else {
            const msg = {
                title: "registartion failed.",
                message: "Email address already in use.",
            };
            res.status(409).json(msg)
            return;
        }
    } catch (error) {
        console.log(error)
        const msg = {
            title: "registeration failed.",
            message: error.message,
        };
        res.status(503).json(msg)
    }
}

/**
 * Performs login attempt
 * @returns response as json object
 */
export async function loginUser(req, res, next) {
    const email = req.body.email;
    const password = req.body.password;

    try {
        const isEmailExists = await checkIfEmailExists(email)
        if (isEmailExists) {
            const successfulLogin = await login(email, password)
            if (successfulLogin) {
                const recipes = await getRecipesFromDB(email)
                const tokens = await generateTokens(email);

                if (tokens) {
                    const accessToken = tokens.accessToken;
                    const refreshToken = tokens.refreshToken;

                    const msg = {
                        title: "User logged in successfully .",
                        succussfull: true,
                        recipes: recipes
                    }

                    const jwtCookie = createCookie('jwtToken', accessToken)
                    const refreshCookie = createCookie('refreshToken', refreshToken)

                    res.setHeader('Set-Cookie', [jwtCookie, refreshCookie])
                    res.json(msg)
                }
            }
        }
        else {
            const msg = {
                title: "login failed.",
                message: "email/password does not match",
            };
            res.status(401).json(msg)
        }
    } catch (error) {
        console.log(error)
        const msg = {
            title: "login failed.",
            message: error.message,
        };
        res.status(503).json(msg)
        return;
    }
}

/**
 * generates a secret key to be used with JWT
 * @param {*} email  the email that we create a token for
 * @param {*} isRefresh is it a refresh token or not
 * @returns secret key
 */
async function generateKey(email, isRefresh) {
    const token = crypto.randomBytes(64).toString('hex')
    const isStoredSuccussfuly = await storeSecret(email, token, isRefresh)

    if (isStoredSuccussfuly) {
        return token
    }
    else {
        console.log("failed to store secret")

        // In that stage, the user info is already saved in DB, but the registeration is not complete. 
        // Next time the user will try to register - it will say he already have an account, so we need to delete the info.
        let isUserDeleted = await deleteUserFromDB(email)

        if (!isUserDeleted) {
            const error = new Error("Registeration failed. Please try again later.")
            error.name = `${email} registeration attempt failed`;
            sendEmail(error)
            throw error;
        }
        throw new Error("Registeration failed, check logs")

    }
}

/**
 * Checks if the tokens of a user is valid
 * @returns json message indicates if the tokens are valid or not
 */
export async function checkAuth(req, res, next) {
    const jwtToken = req.cookies.jwtToken;
    const refreshToken = req.cookies.refreshToken;
    const email = req.body.email;

    const userSecret = await getSecret(email);

    try {
        const user = jwt.verify(jwtToken, userSecret);
        req.user = user; // attaching user information to the request object, for cases request passing to different middleware

        if (req.path === "/check-tokens") {
            return res.json({ msg: "All good. user is verifed", successfull: true }) //change successfull to successful (just 1 l)
        }
        else if (req.path === "/save") {
            next()
        }

    } catch (err) {
        console.log(err)

        if (err.name === 'TokenExpiredError') {
            const isRefreshTokenValid = await checkIfRefreshTokenValid(refreshToken, email);

            if (isRefreshTokenValid) {
                const user = { email: email }
                const accessToken = jwt.sign(user, userSecret, { expiresIn: '5h' })
                const jwtCookie = createCookie('jwtToken', accessToken)

                req.userData = { "user": user, "accessToken": accessToken }
                res.setHeader('Set-Cookie', jwtCookie)

                if (req.path === "/check-tokens") {
                    const msg = {
                        title: "validation success.",
                        successfull: true
                    }

                    return res.json(msg)
                }
                else if (req.path === "/save") {
                    next()
                }
            }

            return res.status(401).json({ message: 'Session has expired, you have to log in' });
        }
        console.log(err)
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

/**
 * Performs a logout by clearing the cookies from user's browser
 * @returns json message
 */
export async function logoutUser(req, res, next) {
    res.clearCookie('jwtToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({ successfull: true });
}

/**
 * Generates tokens for a user by given secrets
 * @param {*} email the email of the user
 * @param {*} secrets the secrets we want to create tokens for
 * @returns the tokens containing the secerts
 */
async function generateTokens(email, secrets = "") {
    let secret = "";
    let refreshSecret = "";
    if (!secrets) {
        secret = await getSecret(email);
        refreshSecret = await getRefreshSecret(email)
    }
    else {
        secret = secrets.secret;
        refreshSecret = secrets.refreshSecret
    }

    const user = { email: email }
    const accessToken = jwt.sign(user, secret, { expiresIn: '5h' })
    const refreshToken = jwt.sign(user, refreshSecret, { expiresIn: '1w' })

    let tokens = {
        'accessToken': accessToken,
        'refreshToken': refreshToken
    }

    return tokens;
}

/**
 * Checks if a given refresh token is valid
 * @param {*} refreshToken the refresh token to check
 * @param {*} email the email of the user that the refresh token belongs to
 * @returns boolean value indicates if the refresh token is valid or not
 */
async function checkIfRefreshTokenValid(refreshToken, email) {
    let isRefreshTokenValid = false;
    console.log("Checking refresh token...")
    if (!refreshToken) {
        return false;
    }

    const userSecret = await getRefreshSecret(email)
    if (userSecret) {
        jwt.verify(refreshToken, userSecret, (err) => {
            if (!err) {
                isRefreshTokenValid = true;
            }
        })
    }

    return isRefreshTokenValid;
}

/**
 * Calculates the equivalent number of milliseconds for a given number of days.
 * Used in the proccess of creating a cookie
 *
 * @param {number} days The number of days to convert.
 * @returns {number} The calculated number of milliseconds.
 */
function getCustomMaxAge(days) {

    if (typeof days !== 'number' || days <= 0) {
        console.error('getCustomMaxAge requires a positive number for the days argument. Setting it to be 0.');
        return 0;
    }

    return days * 24 * 60 * 60 * 1000;

}
/**
** 
* Creates an HTTP-only cookie header string with customized options for secure storage of JWT tokens.
 * @param {string} name The name of the cookie to be set.
 * @param {*} value The value to be stored in the cookie, used for a JWT token.
 * @returns {string} The serialized cookie header string to be set using `res.setHeader('Set-Cookie', [cookie])`.
 *
 */
function createCookie(name, value) {

    const cookie = serialize(name, value, {
        httpOnly: true,
        secure: true,
        maxAge: getCustomMaxAge(18),
        partitioned: true,
        sameSite: 'none',
        path: '/api'
    })

    return cookie;
}