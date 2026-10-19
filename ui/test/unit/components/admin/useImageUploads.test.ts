import { act, renderHook, waitFor } from "@testing-library/react";

import { POLL_ATTEMPTS, POLL_INTERVAL_MS, useImageUploads } from "@/components/admin/useImageUploads";
import { json, requestsTo, stubApi } from "../../../utils";

const ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const UPLOAD_ID = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const UPLOAD_URL = "https://uploads.test/";
const REQUEST_UPLOAD = `POST /api/products/${ID}/images?contentType=image%2Fpng`;
const STORE = `POST ${UPLOAD_URL}`;
const POLL = `GET /api/products/${ID}/uploads/${UPLOAD_ID}`;

const png = (name = "shield.png") => new File(["png"], name, { type: "image/png" });

const stubUploads = (handlers: Parameters<typeof stubApi>[0]) =>
  stubApi({
    [REQUEST_UPLOAD]: () => json(201, { url: UPLOAD_URL, fields: {}, uploadId: UPLOAD_ID }),
    [STORE]: () => new Response(null, { status: 204 }),
    [POLL]: () => json(200, { id: UPLOAD_ID, status: "Pending" }),
    ...handlers
  });

const renderUploads = () => {
  const onFinished = vi.fn();
  const hook = renderHook(() => useImageUploads(ID, onFinished));
  return { ...hook, onFinished };
};

const states = (result: ReturnType<typeof renderUploads>["result"]) =>
  result.current.uploads.map(({ name, state }) => `${name}: ${state}`);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useImageUploads", () => {
  it("reports an image the product already has", async () => {
    stubUploads({ [POLL]: () => json(200, { id: UPLOAD_ID, status: "Duplicate" }) });
    const { result, onFinished } = renderUploads();

    act(() => result.current.start([png()]));
    await waitFor(() => expect(states(result)).toEqual(["shield.png: processing"]));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));

    await waitFor(() => expect(states(result)).toEqual(["shield.png: duplicate"]));
    expect(onFinished).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ name: "shield.png", state: "duplicate" })
    );
  });

  it("gives up waiting once processing runs out of polls", async () => {
    const fetch = stubUploads({});
    const { result, onFinished } = renderUploads();

    act(() => result.current.start([png()]));
    await waitFor(() => expect(states(result)).toEqual(["shield.png: processing"]));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS));

    await waitFor(() => expect(states(result)).toEqual(["shield.png: timedOut"]));
    expect(requestsTo(fetch, POLL)).toHaveLength(POLL_ATTEMPTS);
    expect(onFinished).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: "timedOut" }));
  });

  it("fails the upload when storage refuses the file", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = stubUploads({ [STORE]: () => new Response(null, { status: 403 }) });
    const { result, onFinished } = renderUploads();

    act(() => result.current.start([png()]));

    await waitFor(() => expect(states(result)).toEqual(["shield.png: failed"]));
    expect(onFinished).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ state: "failed" }));
    expect(error).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(requestsTo(fetch, POLL)).toHaveLength(0);
  });

  it("stops polling quietly when unmounted mid-upload", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = stubUploads({});
    const { result, onFinished, unmount } = renderUploads();

    act(() => result.current.start([png()]));
    await waitFor(() => expect(states(result)).toEqual(["shield.png: processing"]));
    await act(() => vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS));
    expect(requestsTo(fetch, POLL)).toHaveLength(1);

    unmount();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * POLL_ATTEMPTS);

    expect(requestsTo(fetch, POLL)).toHaveLength(1);
    expect(onFinished).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("clears finished uploads and keeps the ones still going", async () => {
    stubUploads({ [REQUEST_UPLOAD]: () => new Promise<Response>(() => undefined) });
    const { result } = renderUploads();

    act(() => result.current.start([new File(["text"], "notes.txt", { type: "text/plain" }), png()]));
    await waitFor(() => expect(states(result)).toEqual(["notes.txt: notImage", "shield.png: uploading"]));
    act(() => result.current.clearFinished());

    expect(states(result)).toEqual(["shield.png: uploading"]);
  });
});
