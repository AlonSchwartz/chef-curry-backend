import express from 'express';
import { router as users } from "./routes/users.js"
import { router as recipes } from "./routes/recipes.js"
import cors from 'cors'
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json())
app.use(cookieParser())

var whitelist = ['http://localhost:4200', 'https://chef-curry-backend.onrender.com', 'https://chef-curry-ai.vercel.app']

var corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error('Chef-Curry: Not allowed by CORS'))
        }
    },
    optionsSuccessStatus: 200,
    credentials: true,
    methods: ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "X-Content-Type-Options", "Access-Control-Request-Method", "Access-Control-Request-Headers", "Access-Control-Allow-Credentials"]
}

app.use(cors(corsOptions))

app.get("/", (req, res) => {
    res.json("Chef Curry api is online");
});

app.use("/api/auth", users);
app.use("/api/recipes", recipes)

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
})

// Setting up connection
const port = process.env.PORT || 9001;
app.listen(port, () => console.log(`Listening to port ${port}`));