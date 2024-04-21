import { serialize } from 'cookie';
import { createUserInDB, checkIfEmailExists, login, hashPassword, getSecret, getRefreshSecret, updateSecret, storeSecret } from '../database.js';
import { getRecipesFromDB } from "../recipeDatabase.js";

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

            console.warn("Setting a cookie after user signup")

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
                    console.warn("created cookies after login, and now going to set them.")
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
        console.log("failed to create a token")

        /////// In that stage, the user info is already saved in DB, but the registeration is not complete. 
        // Next time the user will try to register - it will say he already have an account, so we need to delete the info.
        throw new Error("Registeration failed, check logs")
    }
}

async function reGenerateKey(email) {
    const token = crypto.randomBytes(64).toString('hex')
    const isStoredSuccussfuly = await updateSecret(email, token)

    if (isStoredSuccussfuly) {
        return token
    }
    else {
        console.log("failed to create a token")
        throw new Error("Registeration failed, check logs")
    }
}

/**
 * Checks if the tokens of a user is valid
 * @returns json message indicates if the tokens are valid or not
 */
export async function checkAuth(req, res, next) {
    let currDate = new Date();

    console.log("Hii!!!! i am checking auth " + currDate.getHours() + ":" + currDate.getMinutes() + ":" + currDate.getSeconds())

    console.log("jwtToken:")
    console.log(req.cookies.jwtToken)
    console.log("==")
    console.log("refreshToken:")
    console.log(req.cookies.refreshToken)
    console.log("======")

    const jwtToken = req.cookies.jwtToken;
    const refreshToken = req.cookies.refreshToken;

    const email = req.body.email;
    console.log("email is " + email)

    const userSecret = await getSecret(email);
    console.log(userSecret)
    console.log(jwtToken)
    try {
        const user = await jwt.verify(jwtToken, userSecret);
        console.log(user)
        console.log("its verified. now sending back and going next.")
        req.user = user;

        if (req.path === "/check-tokens") {
            return res.json({ msg: "All good. user is verifed", successfull: true }) //change successfull to successful (just 1 l)
        }
        else if (req.path === "/save") {
            next()
        }

    } catch (err) {
        console.log("there is an error")
        console.log(err)
        // check if error is token expired
        if (err.name === 'TokenExpiredError') {
            console.log("i will check now if refresh token is valid.")
            // check if refresh token is valid
            const isRefreshTokenValid = await checkIfRefreshTokenValid(refreshToken, email);

            if (isRefreshTokenValid) {
                console.log("refresh token is good!");

                // const secret = await reGenerateKey(email);
                const secret = await getSecret(email)
                console.log("================================")
                console.log("regen key: " + secret)
                console.log("================================")

                const user = { email: email }
                const accessToken = jwt.sign(user, secret, { expiresIn: '5h' })
                req.userData = { "user": user, "accessToken": accessToken }

                const jwtCookie = createCookie('jwtToken', accessToken)
                console.warn("Setting a cookie because it was expired, but the refresh is valid")
                res.setHeader('Set-Cookie', jwtCookie)


                const msg = {
                    title: "validation success.",
                    successfull: true
                }

                if (req.path === "/check-tokens") {
                    return res.json(msg)
                }
                else if (req.path === "/save") {
                    next()
                }
                // create a new access token
                // update in db
                // do what the user wanted to do
                // return the accesstoken

                //  return res.json({ msg: "All good" });
            }

            return res.status(401).json({ message: 'Session has expired, you have to log in' });

            // add return with redirect to login, saying "session has expried, you have to log in"
        }
        console.log("Not good!!!")
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

export async function logoutUser(req, res, next) {
    console.log("in logout")

    res.clearCookie('jwtToken');
    res.clearCookie('refreshToken');

    return res.status(200).json({ successfull: true });

}

async function generateTokens(email, secrets = "") {
    let secret = "";
    let refreshSecret = "";
    if (!secrets) {
        console.log("No secret!")
        secret = await getSecret(email);
        refreshSecret = await getRefreshSecret(email)
    }
    else {
        secret = secrets.secret;
        refreshSecret = secrets.refreshSecret
    }

    console.log("Secret is ")
    console.log(secret)
    const user = { email: email }
    const accessToken = jwt.sign(user, secret, { expiresIn: '5h' })
    const refreshToken = jwt.sign(user, refreshSecret, { expiresIn: '1w' })

    let tokens = {
        'accessToken': accessToken,
        'refreshToken': refreshToken
    }
    console.log("I am in genTokens methos. tokens are: ")
    console.log(tokens)
    return tokens;
}

async function checkIfRefreshTokenValid(refreshToken, email) {
    console.log("Checking refresh token.............................")
    if (!refreshToken) {
        return false;
    }

    const userSecret = getRefreshSecret(email);
    const isRefreshTokenValid = await new Promise((resolve) => {
        userSecret.then(res => {
            console.log("testing tests")
            // console.log(res)
            jwt.verify(refreshToken, res, (err, user) => {
                if (err) {
                    console.log("Not good. returning false. 123")
                    resolve(false);
                }
                else {
                    console.log("Fine. returning true. 123")
                    resolve(true);
                }
            })
        })
    })


    return isRefreshTokenValid;
}

export async function saveRecipe(req, res, next) {

    console.log("Saving.......")
    console.log("This is what i got:")
    console.log(req.body.email)
    console.log(req.body.recipe)


    /*

    const accessToken = req.userData.accessToken;

    res.cookie('jwtToken', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
    })*/

    return res.json({ msg: "i saved it and All good" });

}

/**
 * Calculates the equivalent number of milliseconds for a given number of days.
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