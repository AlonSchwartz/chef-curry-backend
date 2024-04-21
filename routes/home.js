import express from 'express';
const router = express.Router();

router.get("/", async (req, res) => {
    const msg = {
        title: "Express Testing",
        message: "The app is working properly! 123",
    };
    res.status(200).json(msg);
});

export { router };