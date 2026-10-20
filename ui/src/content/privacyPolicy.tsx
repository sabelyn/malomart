import { Link } from "react-router";

import type { LegalSection } from "@/components/LegalDocument";
import { contactLink } from "@/content/contact";
import { ACCOUNT_PATH, TERMS_PATH } from "@/routes/paths";

export const privacyPolicy: { lastUpdated: string; sections: LegalSection[] } = {
  lastUpdated: "October 19, 2026",
  sections: [
    {
      id: "about",
      heading: "About Malo Mart",
      body: (
        <>
          <p>
            Malo Mart is a portfolio project built and run by Sabelyn Thorpe: a pretend online store built to
            demonstrate a web application running on Amazon Web Services. Nothing is actually for sale. Orders are never
            fulfilled, nothing is shipped, and no real payments are processed.
          </p>
          <p>
            Signing up still uses your real email address, so this policy explains what the site collects, why, who can
            see it, and how to get rid of it. It covers the Malo Mart website at malomart.link and its subdomains. The
            rules for using the site are in the <Link to={TERMS_PATH}>Terms of Service</Link>.
          </p>
        </>
      )
    },
    {
      id: "what-we-collect",
      heading: "What we collect",
      body: (
        <>
          <p>
            <strong>Account details.</strong> Your email address and the name you give when you sign up. Sign-in uses
            one-time codes sent to your email, so there's no password to store.
          </p>
          <p>
            <strong>Google sign-in.</strong> If you choose to sign in with Google, Google shares your email address,
            whether Google has verified it, your name, your profile picture, and the ID Google uses for your account. We
            keep your email address, your name, and that ID so your Google sign-in stays linked to your Malo Mart
            account. We don't keep your profile picture, and we don't get access to anything else in your Google
            account.
          </p>
          <p>
            <strong>Saved addresses.</strong> The label, recipient name, street, city, region, and postal code you
            enter. Regions are fictional and nothing ships, so please make up the rest too.
          </p>
          <p>
            <strong>Saved payment cards.</strong> The card brand, card number, and expiration date you enter. Card
            brands are fictional and the site only accepts made-up card numbers. Please don't enter a real card. Card
            numbers are encrypted with a dedicated key and stored apart from the rest of your account; still, give us
            fake ones.
          </p>
          <p>
            <strong>Orders.</strong> The items, prices, delivery option, and order status, along with a copy of the
            address and the card details (brand, last four digits, and expiration date) used for that order.
          </p>
          <p>
            <strong>Shopping cart.</strong> Which products are in your cart and how many. While you're signed in, your
            cart is saved with your account. While you're signed out, it's saved only in your browser.
          </p>
          <p>
            <strong>Email delivery records.</strong> If an email we send you bounces or is marked as spam, a record of
            that, including your email address, is kept so the site can stop sending to addresses that don't want its
            mail.
          </p>
          <p>
            Malo Mart doesn't use analytics, advertising, or tracking services, and doesn't collect information about
            you from anywhere other than you and, if you use it, Google sign-in.
          </p>
        </>
      )
    },
    {
      id: "cookies",
      heading: "Cookies and browser storage",
      body: (
        <>
          <p>Malo Mart uses only what it needs to keep you signed in and remember your cart:</p>
          <ul>
            <li>
              Session cookies that keep you signed in. One lasts 15 minutes and is renewed automatically; another lets
              it be renewed for up to 30 days. Both are deleted when you sign out.
            </li>
            <li>
              Short-lived cookies, lasting up to 10 minutes, that hold your place while you're entering a sign-in code
              or signing in with Google.
            </li>
            <li>Your browser's local storage, which holds your cart while you're signed out.</li>
          </ul>
          <p>
            These cookies can't be read by scripts on the page and are only sent to Malo Mart. There are no advertising
            or third-party tracking cookies.
          </p>
        </>
      )
    },
    {
      id: "how-we-use-it",
      heading: "How we use it",
      body: (
        <>
          <ul>
            <li>To create your account, sign you in, and keep your account secure.</li>
            <li>To send you sign-in codes and emails about your orders.</li>
            <li>To show you your saved addresses, cards, cart, and orders, and to run the pretend checkout.</li>
            <li>To keep the site working, including fixing errors and preventing abuse.</li>
          </ul>
          <p>
            Your information isn't used for advertising, isn't sold, and isn't used to send you marketing email. The
            only emails Malo Mart sends are sign-in codes and updates about orders you placed.
          </p>
        </>
      )
    },
    {
      id: "google-user-data",
      heading: "Information from Google",
      body: (
        <p>
          Information received from Google is used only to sign you in and to link your Google sign-in to your Malo Mart
          account, as described above. It isn't shared with anyone else or used for any other purpose. Malo Mart's use
          of information received from Google APIs adheres to the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      )
    },
    {
      id: "who-can-see-it",
      heading: "Who can see it",
      body: (
        <>
          <ul>
            <li>
              <strong>Amazon Web Services</strong> hosts the site and stores its data in the United States. AWS runs the
              sign-in system, sends the site's email, stores account and order data, and holds the key that encrypts
              card numbers.
            </li>
            <li>
              <strong>Google</strong> takes part only if you choose to sign in with Google.
            </li>
            <li>
              <strong>Sabelyn Thorpe</strong>, who runs the site, can see orders, including the recipient name and
              address on each one, through the store's back office, and can see account details when maintaining the
              site.
            </li>
          </ul>
          <p>Your information isn't shared with anyone else unless the law requires it.</p>
        </>
      )
    },
    {
      id: "how-long-we-keep-it",
      heading: "How long we keep it",
      body: (
        <>
          <ul>
            <li>Account details, saved addresses, and saved cards: until you delete them or delete your account.</li>
            <li>
              Orders: kept as store records after you delete your account. They're no longer connected to your email
              address, but they still contain the recipient name, address, and card details used for each order.
            </li>
            <li>Server logs, which can include account IDs but not email addresses: 7 days.</li>
            <li>Records of bounced or rejected email: 90 days.</li>
            <li>
              Email you send to {contactLink}: a copy is stored on the site's servers for 7 days while it's forwarded to
              Sabelyn Thorpe, who keeps it as long as needed to answer you.
            </li>
          </ul>
          <p>
            Separately from this site, Amazon's email service may keep its own list of addresses that bounced or
            reported mail as spam so it doesn't keep sending to them. Because Malo Mart is a demo, all of its data may
            also be wiped at any time without notice.
          </p>
        </>
      )
    },
    {
      id: "your-choices",
      heading: "Your choices",
      body: (
        <>
          <ul>
            <li>
              You can change your name and email address, and delete saved addresses and cards, from{" "}
              <Link to={ACCOUNT_PATH}>your account</Link>.
            </li>
            <li>
              You can delete your account from the Profile page in your account. This immediately deletes your account,
              saved addresses, and saved cards. Orders are kept as described above.
            </li>
            <li>
              If you signed in with Google, you can also remove Malo Mart from your{" "}
              <a href="https://myaccount.google.com/connections">Google account's third-party connections</a>.
            </li>
            <li>
              For anything else, including a copy of your information or removing your orders, email {contactLink}.
            </li>
          </ul>
        </>
      )
    },
    {
      id: "security",
      heading: "Security",
      body: (
        <p>
          The site is served only over HTTPS. Sign-in cookies can't be read by scripts on the page, stored data is
          encrypted, and card numbers get a dedicated encryption key on top of that. No system is perfectly secure,
          though, and this one is a demo, so please don't give it anything more sensitive than your email address.
        </p>
      )
    },
    {
      id: "children",
      heading: "Children",
      body: <p>Malo Mart isn't intended for children under 13 and doesn't knowingly collect their information.</p>
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      body: (
        <p>
          If what the site collects or how it's used changes, this page will be updated and the date at the top will
          change with it.
        </p>
      )
    },
    {
      id: "contact",
      heading: "Contact",
      body: <p>Questions or requests about your information can go to {contactLink}.</p>
    }
  ]
};
