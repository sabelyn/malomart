import type { ImageUploadStatus } from "@mm/lib/products";
import { getImageUpload, MAX_UPLOAD_BYTES, requestImageUpload } from "@mm/lib/products";
import { useEffect, useRef, useState } from "react";

import { apiCall } from "@/api";

export const POLL_INTERVAL_MS = 1500;
export const POLL_ATTEMPTS = 20;

export type UploadState =
  "uploading" | "processing" | "added" | "duplicate" | "rejected" | "notImage" | "tooLarge" | "timedOut" | "failed";

export type ImageUploadItem = { id: string; name: string; state: UploadState };

export const isUploadDone = (state: UploadState) => state !== "uploading" && state !== "processing";

const FINISHED_STATES: Record<Exclude<ImageUploadStatus, "Pending">, UploadState> = {
  Ready: "added",
  Duplicate: "duplicate",
  Rejected: "rejected"
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The upload was cancelled.", "AbortError"));
    });
  });

const pollUpload = async (productId: string, uploadId: string, signal: AbortSignal): Promise<UploadState> => {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await wait(POLL_INTERVAL_MS, signal);
    const { status } = await apiCall(getImageUpload, { params: { id: productId, uploadId } }, { signal });
    if (status !== "Pending") {
      return FINISHED_STATES[status];
    }
  }
  return "timedOut";
};

const postToStorage = async (url: string, fields: Record<string, string>, file: File, signal: AbortSignal) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.append(key, value);
  }
  body.append("file", file);
  const response = await fetch(url, { method: "POST", body, signal });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}.`);
  }
};

export const useImageUploads = (productId: string, onFinished: (upload: ImageUploadItem) => void) => {
  const [uploads, setUploads] = useState<ImageUploadItem[]>([]);
  const controllerRef = useRef(new AbortController());
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);

  const setState = (id: string, state: UploadState) =>
    setUploads(current => current.map(upload => (upload.id === id ? { ...upload, state } : upload)));

  const run = async (upload: ImageUploadItem, file: File) => {
    const { signal } = controllerRef.current;
    const finish = (state: UploadState) => {
      setState(upload.id, state);
      onFinishedRef.current({ ...upload, state });
    };

    if (!file.type.startsWith("image/")) {
      finish("notImage");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      finish("tooLarge");
      return;
    }

    try {
      const { url, fields, uploadId } = await apiCall(
        requestImageUpload,
        { params: { id: productId }, query: { contentType: file.type } },
        { signal }
      );
      await postToStorage(url, fields, file, signal);
      setState(upload.id, "processing");
      finish(await pollUpload(productId, uploadId, signal));
    } catch (err) {
      if (!signal.aborted) {
        console.error(`Image upload of ${file.name} failed.`, err);
        finish("failed");
      }
    }
  };

  const start = (files: File[]) => {
    const added = files.map(file => ({
      file,
      upload: { id: crypto.randomUUID(), name: file.name, state: "uploading" as const }
    }));
    setUploads(current => [...current, ...added.map(({ upload }) => upload)]);
    for (const { file, upload } of added) {
      void run(upload, file);
    }
  };

  const clearFinished = () => setUploads(current => current.filter(upload => !isUploadDone(upload.state)));

  return { uploads, start, clearFinished };
};
