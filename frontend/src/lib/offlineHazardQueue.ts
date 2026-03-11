type PendingHazardReport = {
  category: string;
  description: string;
  authorName: string;
  location: { lat: number; lng: number };
  createdAt: string;
  hadImage: boolean;
};

const STORAGE_KEY = "pending_hazard_reports_v1";

const readQueue = (): PendingHazardReport[] => {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }
    const parsedValue = JSON.parse(rawValue) as PendingHazardReport[];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: PendingHazardReport[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const addPendingHazardReport = (item: PendingHazardReport) => {
  const queue = readQueue();
  queue.push(item);
  writeQueue(queue);
};

export const getPendingHazardCount = () => readQueue().length;

export const flushPendingHazardReports = async (authToken: string) => {
  const queue = readQueue();
  if (!queue.length) {
    return { sent: 0, remaining: 0 };
  }

  const remaining: PendingHazardReport[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      const formData = new FormData();
      formData.append("category", item.category);
      formData.append("description", item.description);
      formData.append("is_active", "true");
      formData.append("author_name", item.authorName);
      formData.append(
        "location",
        JSON.stringify({
          type: "Point",
          coordinates: [item.location.lng, item.location.lat],
        }),
      );

      const response = await fetch("http://localhost:8000/api/hazards/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        remaining.push(item);
        continue;
      }

      sent += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { sent, remaining: remaining.length };
};
