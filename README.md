# ZING Social Media App
This assignment is to built the front-end for a social media application
![image alt](https://github.com/SidraShahid0510/ZING-SM-APP/blob/main/zing-img.png?raw=true)

Zing is a social app built with vanilla HTML/CSS/JS and ES6 modules.The front-end will allow users to perform CRUD operations (Create, Read, Update, and Delete) on their own posts, as well as implement additional features such as following/unfollowing users, commenting on posts, and reacting to a post with an emoji.
# Features
- Auth flow (login/register) with token storage in localStorage

- Feed page (everyone’s posts) + My profile page (my posts only)

- User profile page for other users

- Create / edit / delete posts (image preview, emoji insert)

- Like & comment with live count updates

- Follow / unfollow from cards or detail view

- Post detail modal with composer and emoji picker

- ES6 modules split into small, reusable files
# Teck Stack
- Front-end: HTML, CSS, Vanilla JS (ES modules)

- API: Noroff Social API (v2)

# How to run this project
1) Zing uses **ES6 modules**, so you must run it over **HTTP** (not `file://`).
##### Prerequisites
- A modern browser (Chrome/Edge/Firefox/Safari).
- A Noroff Social API account + API key.
2) Start a local server
 - Install the “Live Server” extension.

- Right-click index.html → Open with Live Server.

- It opens at something like http://127.0.0.1:5500/.
3) Use the app

- Open index.html for the main feed.

- Open login-user.html for your profile (after logging in).

- Open user-profile.html?username=<name> to view someone else’s profile.
4) Login / Register

- Use the built-in forms to register or log in.

- The app stores accessToken, name, and cached avatarUrl in localStorage.
# Contributing
PRs welcome! Keep functions small, add JSDoc to new modules, and prefer pure functions in APIs and DOM-only in renderers.
# Live Site
[ZING Live Link](https://sidrashahid0510.github.io/ZING-SM-APP/index.html)
