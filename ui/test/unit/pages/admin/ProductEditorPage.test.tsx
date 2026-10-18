import type { ProductDto } from "@mm/lib/products";
import { MAX_UPLOAD_BYTES } from "@mm/lib/products";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import { POLL_INTERVAL_MS } from "@/components/admin/useImageUploads";
import ProductEditorPage from "@/pages/admin/ProductEditorPage";
import { admin, announced, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const UPLOAD_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const GET = `GET /api/products/${ID}`;
const UPLOAD_URL = "https://uploads.test/";

const product: ProductDto = {
  id: ID,
  title: "Hylian Shield",
  description: "Sturdy, fireproof, and no longer priced like a castle.",
  category: "Shields",
  price: 200,
  originalPrice: 250,
  stockCount: 2,
  thumbnailKey: `products/${ID}/bbbb`,
  imageKeys: [`products/${ID}/aaaa`, `products/${ID}/bbbb`],
  features: ["Fireproof"]
};

const renderEditor = (route = `/admin/products/${ID}`) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/admin/products" element={<p>product list</p>} />
        <Route path="/admin/products/new" element={<ProductEditorPage />} />
        <Route path="/admin/products/:id" element={<ProductEditorPage />} />
      </Routes>
      <LocationDisplay />
    </>,
    { route, session: admin }
  );

const section = (name: string) => screen.getByRole("region", { name });

const location = () => screen.getByTestId("location").textContent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("new product", () => {
  it("creates the product and moves to its editor", async () => {
    const created: ProductDto = { ...product, originalPrice: undefined, imageKeys: [], thumbnailKey: undefined };
    const fetch = stubApi({
      "POST /api/products": () => json(201, created),
      [GET]: () => json(200, created)
    });
    const user = userEvent.setup();
    renderEditor("/admin/products/new");

    expect(screen.getByRole("heading", { level: 1, name: "New product" })).toBeTruthy();
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Hylian Shield");
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "Shields");
    await user.type(screen.getByRole("textbox", { name: "Description" }), product.description);
    await user.type(screen.getByRole("textbox", { name: "Price" }), "200");
    await user.type(screen.getByRole("textbox", { name: "Starting stock" }), "2");
    await user.click(screen.getByRole("button", { name: "Add a feature" }));
    await user.type(screen.getByRole("textbox", { name: "Feature 1" }), "Fireproof");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    await waitFor(() => expect(location()).toBe(`/admin/products/${ID}`));
    expect(requestsTo(fetch, "POST /api/products")).toEqual([
      {
        title: "Hylian Shield",
        category: "Shields",
        description: product.description,
        price: 200,
        stockCount: 2,
        features: ["Fireproof"]
      }
    ]);
    expect(await screen.findByRole("heading", { level: 1, name: "Edit Hylian Shield" })).toBeTruthy();
  });

  it("explains what's missing without sending anything", async () => {
    const fetch = stubApi({});
    const user = userEvent.setup();
    renderEditor("/admin/products/new");

    await user.click(screen.getByRole("button", { name: "Add a feature" }));
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText("Titles need at least 3 characters.")).toBeTruthy();
    expect(screen.getByText("Choose a category.")).toBeTruthy();
    expect(screen.getByText("Descriptions need at least 3 characters.")).toBeTruthy();
    expect(screen.getByText("Enter a price.")).toBeTruthy();
    expect(screen.getByText("Enter how many are in stock.")).toBeTruthy();
    expect(screen.getByText("Enter a feature or remove it.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires the original price to be higher than the price", async () => {
    stubApi({});
    const user = userEvent.setup();
    renderEditor("/admin/products/new");

    await user.type(screen.getByRole("textbox", { name: "Price" }), "200");
    await user.type(screen.getByRole("textbox", { name: "Original price" }), "150");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(screen.getByText("The original price has to be higher than the price, or leave it blank.")).toBeTruthy();
  });
});

describe("editing details", () => {
  it("sends only the fields that changed", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`PUT /api/products/${ID}`]: () => json(200, { ...product, price: 180 })
    });
    const user = userEvent.setup();
    renderEditor();

    const price = await screen.findByRole("textbox", { name: "Price" });
    await user.clear(price);
    await user.type(price, "180");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(requestsTo(fetch, `PUT /api/products/${ID}`)).toEqual([{ price: 180 }]));
    expect(document.title).toBe("Hylian Shield · Back office · Malo Mart");
  });

  it("removes the sale when the original price is cleared", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`PUT /api/products/${ID}`]: () => json(200, { ...product, originalPrice: undefined })
    });
    const user = userEvent.setup();
    renderEditor();

    await user.clear(await screen.findByRole("textbox", { name: "Original price" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(requestsTo(fetch, `PUT /api/products/${ID}`)).toEqual([{ originalPrice: null }]));
  });

  it("edits the feature list", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`PUT /api/products/${ID}`]: () => json(200, product)
    });
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Add a feature" }));
    await user.type(screen.getByRole("textbox", { name: "Feature 2" }), "Blocks lasers");
    await user.click(screen.getByRole("button", { name: "Remove feature 1" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(requestsTo(fetch, `PUT /api/products/${ID}`)).toEqual([{ features: ["Blocks lasers"] }])
    );
  });

  it("says so when nothing changed", async () => {
    const fetch = stubApi({ [GET]: () => json(200, product) });
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Save changes" }));

    expect(within(section("Details")).getByRole("status").textContent).toBe("Nothing changed.");
    expect(requestsTo(fetch, `PUT /api/products/${ID}`)).toHaveLength(0);
  });

  it("shows a not found page for a missing product", async () => {
    stubApi({ [GET]: () => json(404, { message: "Product could not be found." }) });
    renderEditor();

    expect(await screen.findByRole("heading", { level: 1, name: "Product not found" })).toBeTruthy();
  });
});

describe("stock", () => {
  it("adds stock and reports the new count", async () => {
    let current = product;
    const fetch = stubApi({
      [GET]: () => json(200, current),
      [`POST /api/products/${ID}/stock`]: body => {
        current = { ...product, stockCount: product.stockCount + (body as { change: number }).change };
        return json(200, current);
      }
    });
    const user = userEvent.setup();
    renderEditor();

    const amount = await screen.findByRole("textbox", { name: "Amount" });
    await user.clear(amount);
    await user.type(amount, "5");
    await user.click(screen.getByRole("button", { name: "Add stock" }));

    const stock = section("Stock");
    expect(await within(stock).findByText("Added 5. 7 in stock now.")).toBeTruthy();
    expect(requestsTo(fetch, `POST /api/products/${ID}/stock`)).toEqual([{ change: 5 }]);
    expect(await within(stock).findByText("7 in stock.")).toBeTruthy();
  });

  it("shows the server's reason when there isn't enough to remove", async () => {
    stubApi({
      [GET]: () => json(200, product),
      [`POST /api/products/${ID}/stock`]: () => json(409, { message: "Can't remove 3 when only 2 in stock." })
    });
    const user = userEvent.setup();
    renderEditor();

    const amount = await screen.findByRole("textbox", { name: "Amount" });
    await user.clear(amount);
    await user.type(amount, "3");
    await user.click(screen.getByRole("button", { name: "Remove stock" }));

    expect((await within(section("Stock")).findByRole("alert")).textContent).toBe(
      "Can't remove 3 when only 2 in stock."
    );
  });

  it("asks for an amount before sending", async () => {
    const fetch = stubApi({ [GET]: () => json(200, product) });
    const user = userEvent.setup();
    renderEditor();

    await user.clear(await screen.findByRole("textbox", { name: "Amount" }));
    await user.click(screen.getByRole("button", { name: "Add stock" }));

    expect(screen.getByText("Enter a whole number from 1 to 10,000.")).toBeTruthy();
    expect(requestsTo(fetch, `POST /api/products/${ID}/stock`)).toHaveLength(0);
  });
});

describe("images", () => {
  it("lists the thumbnail first", async () => {
    stubApi({ [GET]: () => json(200, product) });
    renderEditor();

    const images = await within(await screen.findByRole("region", { name: "Images" })).findAllByRole("listitem");

    expect(images.map(item => item.querySelector("p")?.textContent)).toEqual(["Image 1Thumbnail", "Image 2"]);
    expect(images[0].querySelector("img")?.getAttribute("src")).toBe(`/images/products/${ID}/bbbb-320.webp`);
    expect(within(images[0]).queryByRole("button", { name: "Make image 1 the thumbnail" })).toBeNull();
  });

  it("makes another image the thumbnail", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`PUT /api/products/${ID}/images/aaaa`]: () => json(200, { ...product, thumbnailKey: `products/${ID}/aaaa` })
    });
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Make image 2 the thumbnail" }));

    expect(await screen.findByText("Thumbnail updated. It's now image 1.")).toBeTruthy();
    expect(requestsTo(fetch, `PUT /api/products/${ID}/images/aaaa`)).toHaveLength(1);
  });

  it("deletes an image after confirming", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`DELETE /api/products/${ID}/images/aaaa`]: () => json(200, { ...product, imageKeys: [`products/${ID}/bbbb`] })
    });
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Delete image 2" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete image" }));

    expect(await screen.findByText("Deleted image 2.")).toBeTruthy();
    expect(requestsTo(fetch, `DELETE /api/products/${ID}/images/aaaa`)).toHaveLength(1);
  });

  it("uploads an image and reports when it's ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status = "Pending";
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`POST /api/products/${ID}/images?contentType=image%2Fpng`]: () =>
        json(201, { url: UPLOAD_URL, fields: { key: `products/${ID}/${UPLOAD_ID}` }, uploadId: UPLOAD_ID }),
      [`POST ${UPLOAD_URL}`]: () => new Response(null, { status: 204 }),
      [`GET /api/products/${ID}/uploads/${UPLOAD_ID}`]: () =>
        json(200, { id: UPLOAD_ID, status, ...(status === "Ready" ? { imageKey: `products/${ID}/cccc` } : {}) })
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderEditor();
    await screen.findByRole("region", { name: "Images" });

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, new File(["png"], "shield.png", { type: "image/png" }));

    const uploads = await screen.findByRole("list", { name: "Uploads" });
    await waitFor(() => expect(uploads.textContent).toBe("shield.png: Processing…"));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    status = "Ready";
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await waitFor(() => expect(uploads.textContent).toBe("shield.png: Added."));
    expect(announced()).toBe("shield.png: Added.");
    expect(requestsTo(fetch, `GET /api/products/${ID}/uploads/${UPLOAD_ID}`)).toHaveLength(2);
    const posted = fetch.mock.calls.find(([input]) => String(input) === UPLOAD_URL)![1]!.body as FormData;
    expect(posted.get("key")).toBe(`products/${ID}/${UPLOAD_ID}`);
    expect((posted.get("file") as File).name).toBe("shield.png");
  });

  it("reports an upload the processor rejected", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubApi({
      [GET]: () => json(200, product),
      [`POST /api/products/${ID}/images?contentType=image%2Fpng`]: () =>
        json(201, { url: UPLOAD_URL, fields: {}, uploadId: UPLOAD_ID }),
      [`POST ${UPLOAD_URL}`]: () => new Response(null, { status: 204 }),
      [`GET /api/products/${ID}/uploads/${UPLOAD_ID}`]: () => json(200, { id: UPLOAD_ID, status: "Rejected" })
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderEditor();
    await screen.findByRole("region", { name: "Images" });

    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["nope"], "broken.png", { type: "image/png" })
    );
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    const uploads = screen.getByRole("list", { name: "Uploads" });
    await waitFor(() => expect(uploads.textContent).toBe("broken.png: Couldn't read it as an image."));
    expect(announced("assertive")).toBe("broken.png: Couldn't read it as an image.");
  });

  it("refuses files that aren't images or are too large without uploading them", async () => {
    const fetch = stubApi({ [GET]: () => json(200, product) });
    const user = userEvent.setup({ applyAccept: false });
    renderEditor();
    await screen.findByRole("region", { name: "Images" });

    const big = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });
    await user.upload(document.querySelector<HTMLInputElement>('input[type="file"]')!, [
      new File(["text"], "notes.txt", { type: "text/plain" }),
      big
    ]);

    const items = within(screen.getByRole("list", { name: "Uploads" })).getAllByRole("listitem");
    expect(items.map(item => item.textContent)).toEqual([
      "notes.txt: Not an image file.",
      "huge.png: Over the 10 MB limit."
    ]);
    expect(fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Clear the upload list" }));
    expect(screen.queryByRole("list", { name: "Uploads" })).toBeNull();
  });
});

describe("deleting the product", () => {
  it("deletes it after confirming and returns to the list", async () => {
    const fetch = stubApi({
      [GET]: () => json(200, product),
      [`DELETE /api/products/${ID}`]: () => new Response(null, { status: 204 })
    });
    const user = userEvent.setup();
    renderEditor();

    await user.click(await screen.findByRole("button", { name: "Delete Hylian Shield" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

    await waitFor(() => expect(location()).toBe("/admin/products"));
    expect(requestsTo(fetch, `DELETE /api/products/${ID}`)).toHaveLength(1);
    expect(announced()).toBe("Deleted Hylian Shield.");
  });
});
