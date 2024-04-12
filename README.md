# Reminder-APP

## Description

This project is similar to a todo application but with additional features to schedule your time and receive reminders via email and notifications. It allows you to customize your todo list with ease.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Dependencies](#dependencies)
- [License](#license)

## Installation

1. Clone the repository:

   Open terminal and type - git clone <repository-url>
   
2. Install dependencies:
    in bash type - npm install

3. Create a .env file in the root directory and add the following environment variables:

-   ATLAS_DB=<MongoDB Atlas connection URL>
-   SECRET=<session secret>
-   EMAIL=<your-email>
-   PASSWORD=<your-email-password>
-   Replace <MongoDB Atlas connection URL>, <session secret>, <your-email>, and <your-email-password> with your actual values.
-   Access the application in your browser at `http://localhost:3000`.

## Features

- User authentication
- Schedule and manage todos from ust to isd
- Receive reminders via email and notifications
- Search todos by title or date
- Mark todos as completed or incomplete
- View completed todos
- Google OAuth for authentication
- and many more

## Dependencies

- express
- mongoose
- ejs-mate
- passport
- nodemailer
- body-parser
- express-session
- connect-mongo
- passport-google-oauth20
- node-notifier
- and more

