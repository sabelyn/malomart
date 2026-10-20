import { Link } from "react-router";

import type { LegalSection } from "@/components/LegalDocument";
import { contactLink } from "@/legal/contact";
import { ACCOUNT_PATH, CREDITS_PATH, PRIVACY_PATH } from "@/routes/paths";

export const termsOfService: { lastUpdated: string; sections: LegalSection[] } = {
  lastUpdated: "October 19, 2026",
  sections: [
    {
      id: "agreement",
      heading: "Agreeing to these terms",
      body: (
        <p>
          These terms cover your use of the Malo Mart website at malomart.link and its subdomains. By using the site or
          creating an account, you agree to them. If you don't agree, please don't use the site.
        </p>
      )
    },
    {
      id: "demo",
      heading: "It's a demo store",
      body: (
        <>
          <p>
            Malo Mart is a portfolio project built and run by Sabelyn Thorpe to demonstrate a web application running on
            Amazon Web Services. It looks and behaves like an online store, but:
          </p>
          <ul>
            <li>
              Nothing is actually for sale, and placing an order doesn't create a purchase or any other agreement.
            </li>
            <li>Orders are never fulfilled and nothing is shipped.</li>
            <li>No payments are taken. Prices are in rupees, which aren't real money.</li>
            <li>Order confirmations and status updates aren't receipts or invoices.</li>
          </ul>
        </>
      )
    },
    {
      id: "your-account",
      heading: "Your account",
      body: (
        <ul>
          <li>You must be at least 13 years old to create an account.</li>
          <li>Sign up with an email address you control, and only for yourself.</li>
          <li>
            Sign-in codes are sent to your email. Don't share them; anyone with a code can sign in as you until it
            expires.
          </li>
          <li>You're responsible for what happens under your account.</li>
        </ul>
      )
    },
    {
      id: "fake-details",
      heading: "Use made-up details",
      body: (
        <>
          <p>
            The checkout is pretend, so the details you give it should be too. Don't enter a real credit or debit card
            number. Any 16 digits will work. Addresses use fictional regions, and the rest of the address should be made
            up as well.
          </p>
          <p>
            If you enter real card or address details anyway, they're handled as described in the{" "}
            <Link to={PRIVACY_PATH}>Privacy Policy</Link>, but they aren't used for anything and you're better off
            deleting them from <Link to={ACCOUNT_PATH}>your account</Link>.
          </p>
        </>
      )
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: (
        <>
          <p>Please use the site the way a shopper would. Don't:</p>
          <ul>
            <li>Sign up or request sign-in codes using someone else's email address.</li>
            <li>Create accounts or place orders with scripts, bots, or other automated tools.</li>
            <li>
              Try to get into accounts, data, or parts of the site that aren't yours, or get around its security or
              limits.
            </li>
            <li>Overload the site, run load tests or security scans against it, or scrape it in bulk.</li>
            <li>Use the site to break the law or to harass anyone.</li>
          </ul>
          <p>If you find a security problem, please report it to {contactLink} instead of testing it further.</p>
        </>
      )
    },
    {
      id: "availability",
      heading: "Availability and your data",
      body: (
        <p>
          Malo Mart is a demo run on a small budget. It can change, go offline, or shut down at any time, and its data,
          including accounts, carts, and orders, may be reset or deleted without notice. Don't rely on it to keep
          anything you need.
        </p>
      )
    },
    {
      id: "ending",
      heading: "Closing accounts",
      body: (
        <p>
          You can delete your account at any time from <Link to={ACCOUNT_PATH}>your account</Link>. Sabelyn Thorpe may
          suspend or delete accounts that break these terms, or any account when the site is reset or shut down.
        </p>
      )
    },
    {
      id: "ownership",
      heading: "Nintendo, artwork, and the site itself",
      body: (
        <>
          <p>
            Malo Mart is a non-commercial fan project. The Legend of Zelda and its names, characters, places, and items
            belong to Nintendo. Malo Mart isn't affiliated with, sponsored by, or endorsed by Nintendo.
          </p>
          <p>
            Artwork, fonts, and other work by other people are used with credit, listed on the{" "}
            <Link to={CREDITS_PATH}>Credits</Link> page. The site's code, design, and original writing belong to Sabelyn
            Thorpe. Please don't reuse the site's artwork or content for commercial purposes.
          </p>
        </>
      )
    },
    {
      id: "third-parties",
      heading: "Other services",
      body: (
        <p>
          If you sign in with Google, Google's own terms and privacy policy apply to your Google account. The site is
          hosted on Amazon Web Services. Links to other websites are provided for convenience, and Malo Mart isn't
          responsible for their content.
        </p>
      )
    },
    {
      id: "warranty",
      heading: "No warranty",
      body: (
        <p>
          The site is provided as is and as available, without warranties of any kind, express or implied, including
          warranties of merchantability, fitness for a particular purpose, and non-infringement. There's no promise that
          it will work, stay online, be free of errors, or keep your data.
        </p>
      )
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      body: (
        <p>
          To the fullest extent the law allows, Sabelyn Thorpe isn't liable for any indirect, incidental, special,
          consequential, or punitive damages, or for any loss of data, arising from your use of the site or inability to
          use it. Since the site is free and nothing is sold, total liability for any claim related to the site is zero
          dollars.
        </p>
      )
    },
    {
      id: "privacy",
      heading: "Privacy",
      body: (
        <p>
          The <Link to={PRIVACY_PATH}>Privacy Policy</Link> explains what the site collects about you and what happens
          to it.
        </p>
      )
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      body: (
        <p>
          These terms may be updated. When they are, this page will change and the date at the top will change with it.
          Using the site after an update means you accept the new terms.
        </p>
      )
    },
    {
      id: "contact",
      heading: "Contact",
      body: <p>Questions about these terms can go to {contactLink}.</p>
    }
  ]
};
