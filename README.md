# Chef Curry - Backend 👨‍🍳 
### Built with NodeJS and ExpressJS. Database is PostgreSQL.
### Main features
 * Handles requests for:
    * creating recipes using a 3rd party API (openAI)
    * user operations like login or signup.
    * saving recipes in favorites
    * retrieving recipes
* Using JWT, and saving it in secure http-only cookie
* Using Nodemailer for error logging to my email

### Installation
1. Clone the repository locally
2. Run ``npm install`` to install dependencies.

### Usage
1. Create a .env file in the project root directory.
2. Create prompts files: prompt_content.txt and prompt_prefix
3. Run ```npm start``` to start the server.

### Environment Variables
This project requires the following environment variables:

| Variable        | Description                                     |
| --------------- | ----------------------------------------------- |
| `OPENAI_KEY`    | Your key to the OpenAI API                      |
| `DATABASE_URL`  | The connection string to your database          |
| `ADMIN_EMAIL`   | The email address for the website admin         |
| `EMAIL_APP_PASS`| Your email app password for sending emails      |
| `DEVELOPMENT`   | Indicates if you're in development mode or not |

### Project Secrets
This project requires two files for prompt configuration:

- `prompt_content.txt`: This file contains the main prompt used by the OpenAI API to generate recipes.
- `prompt_prefix`: This file contains an object with two parameters: `starting_line` and `without_additional_ingredients`. These parameters specify the instructions for the OpenAI API when generating recipes.

The structure and content of these files are crucial for the proper functioning of the application.

---

> [!IMPORTANT]
> This project utilizes PostgreSQL as its database management system.  No database schema creation scripts are included as the tables are assumed to be pre-created on your database hosting site.



### For the frontend project repository, please view: https://github.com/AlonSchwartz/chef-curry

