import { User } from "../../../src/models";
import { isMobile } from "../../support/utils";

const apiGraphQL = `${Cypress.env("apiUrl")}/graphql`;

describe("User Sign-up and Login", function () {
  beforeEach(function () {
    cy.task("db:seed");

    cy.intercept("POST", "/users").as("signup");

    cy.intercept("POST", apiGraphQL, (req) => {
      const { body } = req;

      if (body.hasOwnProperty("operationName") && body.operationName === "CreateBankAccount") {
        req.alias = "gqlCreateBankAccountMutation";
      }
    });
  });

  it("should redirect unauthenticated user to signin page", function () {
    cy.visit("/personal");
    cy.location("pathname").should("equal", "/signin");
    cy.visualSnapshot("Redirect to SignIn");
  });

  it("should redirect to the home page after login", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "s3cret", { rememberUser: true });
    });
    cy.location("pathname").should("equal", "/");
  });

  it("should remember a user for 30 days after login", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "s3cret", { rememberUser: true });
    });

    // Verify Session Cookie
    cy.getCookie("connect.sid").should("have.property", "expiry");

    // Logout User
    if (isMobile()) {
      cy.getBySel("sidenav-toggle").click();
    }
    cy.getBySel("sidenav-signout").click();
    cy.location("pathname").should("eq", "/signin");
    cy.visualSnapshot("Redirect to SignIn");
  });

  it("should display login errors", function () {
    cy.visit("/");

    cy.getBySel("signin-username").type("User").find("input").clear().blur();
    cy.get("#username-helper-text").should("be.visible").and("contain", "Username is required");
    cy.visualSnapshot("Display Username is Required Error");

    cy.getBySel("signin-password").type("abc").find("input").blur();
    cy.get("#password-helper-text")
      .should("be.visible")
      .and("contain", "Password must contain at least 4 characters");
    cy.visualSnapshot("Display Password Error");

    cy.getBySel("signin-submit").should("be.disabled");
    cy.visualSnapshot("Sign In Submit Disabled");
  });

  it("should display signup errors", function () {
    cy.intercept("GET", "/signup");

    cy.visit("/signup");

    cy.getBySel("signup-first-name").type("First").find("input").clear().blur();
    cy.get("#firstName-helper-text").should("be.visible").and("contain", "First Name is required");

    cy.getBySel("signup-last-name").type("Last").find("input").clear().blur();
    cy.get("#lastName-helper-text").should("be.visible").and("contain", "Last Name is required");

    cy.getBySel("signup-username").type("User").find("input").clear().blur();
    cy.get("#username-helper-text").should("be.visible").and("contain", "Username is required");

    cy.getBySel("signup-password").type("password").find("input").clear().blur();
    cy.get("#password-helper-text").should("be.visible").and("contain", "Enter your password");

    cy.getBySel("signup-confirmPassword").type("DIFFERENT PASSWORD").find("input").blur();
    cy.get("#confirmPassword-helper-text")
      .should("be.visible")
      .and("contain", "Password does not match");
    cy.visualSnapshot("Display Sign Up Required Errors");

    cy.getBySel("signup-submit").should("be.disabled");
    cy.visualSnapshot("Sign Up Submit Disabled");
  });

  it("should error for an invalid user", function () {
    cy.login("invalidUserName", "invalidPa$$word");

    cy.getBySel("signin-error")
      .should("be.visible")
      .and("have.text", "Username or password is invalid");
    cy.visualSnapshot("Sign In, Invalid Username and Password, Username or Password is Invalid");
  });

  it("should error for an invalid password for existing user", function () {
    cy.database("find", "users").then((user: User) => {
      cy.login(user.username, "INVALID");
    });

    cy.getBySel("signin-error")
      .should("be.visible")
      .and("have.text", "Username or password is invalid");
    cy.visualSnapshot("Sign In, Invalid Username, Username or Password is Invalid");
  });

  it("should allow a visitor to sign-up, login, and logout", function () {
    // User info
    const userInfo = {
      firstName: "Max",
      lastName: "Wix",
      userName: "IsAGreatFitForSuitable",
      password: "s3cret",
    };

    // USER SIGN UP
    // Enter signup page
    cy.visit("/");
    cy.getBySelLike("signup").click();
    cy.getBySelLike("signup-title").should("be.visible").and("contain", "Sign Up");

    // Fill signup form
    cy.getBySelLike("signup-first-name").type(userInfo.firstName);
    cy.getBySelLike("signup-last-name").type(userInfo.lastName);
    cy.getBySelLike("signup-username").type(userInfo.userName);
    cy.getBySelLike("signup-password").type(userInfo.password);
    cy.getBySelLike("signup-confirmPassword").type(userInfo.password);
    cy.visualSnapshot("Sign Up Form Filled");

    // Submit signup form
    cy.getBySel("signup-submit").click();
    cy.wait("@signup");

    // USER LOGIN
    cy.login(userInfo.userName, userInfo.password);

    // USER CREATE BANK ACCOUNT
    // Checking for onboarding dialog
    cy.getBySelLike("user-onboarding-dialog").should("be.visible");
    cy.getBySelLike("user-onboarding-dialog-title").should("be.visible");
    cy.getBySelLike("user-onboarding-dialog-content").should("be.visible");

    // checking background
    cy.getBySelLike("nav-top-notifications-count").should("exist");
    cy.visualSnapshot("User Onboarding Dialog");
    cy.getBySelLike("user-onboarding-next").click();

    cy.getBySel("user-onboarding-dialog-title").should("contain", "Create Bank Account");

    cy.getBySelLike("bankName-input").type("The Best Bank");
    cy.getBySelLike("routingNumber-input").type("987654321");
    cy.getBySelLike("accountNumber-input").type("123456789");
    cy.visualSnapshot("Fill out New Bank Account Form");
    cy.visualSnapshot("Create Bank Account Form Filled");

    cy.getBySelLike("submit").click();
    cy.wait("@gqlCreateBankAccountMutation");

    // Click next after creating bank account
    cy.getBySelLike("user-onboarding-dialog-title").should("be.visible");
    cy.getBySelLike("user-onboarding-next").click();

    // Modal should no longer exist
    cy.getBySelLike("user-onboarding-dialog-title").should("not.exist");

    // Logout
    if (isMobile()) {
      cy.getBySelLike("sidenav-toggle").click();
    } //The internet gave me this one, yay accessible testing!

    cy.getBySelLike("sidenav-signout").click();
    cy.location("pathname").should("eq", "/signin");
  });
});
