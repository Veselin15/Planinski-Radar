export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  token?: string;
  body?: BodyInit | null;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

const isJsonResponse = (contentType: string | null) =>
  Boolean(contentType && contentType.includes("application/json"));

const extractDetailMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const detail = (payload as Record<string, unknown>).detail;
  if (typeof detail === "string") {
    return detail;
  }
  return null;
};

export const getFriendlyErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Сесията е изтекла. Моля, влезте отново.";
    }
    if (error.status === 403) {
      return "Нямате достъп до тази операция.";
    }
    if (error.status >= 500) {
      return "Временен проблем в сървъра. Опитайте отново след малко.";
    }
    return error.message || "Заявката не можа да бъде обработена.";
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Заявката беше прекъсната.";
  }
  if (error instanceof TypeError) {
    return "Проблем с мрежата. Проверете връзката си.";
  }
  return "Възникна неочаквана грешка.";
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", token, body = null, signal, headers = {} } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestHeaders: Record<string, string> = { ...headers };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    method,
    body,
    signal,
    headers: requestHeaders,
  });

  const contentType = response.headers.get("content-type");
  const responsePayload = isJsonResponse(contentType)
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detailMessage =
      typeof responsePayload === "string"
        ? responsePayload
        : extractDetailMessage(responsePayload);
    throw new ApiError(
      detailMessage || `Заявката върна грешка (${response.status}).`,
      response.status,
      responsePayload,
    );
  }

  return responsePayload as T;
}
