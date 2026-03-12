import { expect, test } from "@playwright/test";

const mockUnauthenticatedSession = async (
  page: import("@playwright/test").Page,
) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
};

const mockAuthenticatedSession = async (
  page: import("@playwright/test").Page,
) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          name: "Тест Потребител",
          email: "test@example.com",
          image: null,
        },
        googleIdToken: "fake-id-token",
        expires: "2099-12-31T23:59:59.000Z",
      }),
    });
  });
};

const mockMapApis = async (page: import("@playwright/test").Page) => {
  await page.route("**/api/huts/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 1,
            geometry: { type: "Point", coordinates: [25.4858, 42.7339] },
            properties: { name: "Хижа Тест", elevation: 1500 },
          },
        ],
      }),
    });
  });

  await page.route("**/api/hazards/", async (route, request) => {
    if (request.method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 2 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: 1,
            geometry: { type: "Point", coordinates: [25.4858, 42.7339] },
            properties: {
              category: "Лавина",
              description: "Тестов сигнал",
              upvotes: 1,
              author_name: "Тест",
            },
          },
        ],
      }),
    });
  });

  await page.route("**/api/official-alerts/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features: [],
      }),
    });
  });

  await page.route("**/api/webcam-snapshots/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/feed/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 1, results: [] }),
    });
  });

  await page.route("**/api/hazards/*/upvote/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ upvotes: 2 }),
    });
  });
};

test("smoke: open map", async ({ page }) => {
  await mockUnauthenticatedSession(page);
  await mockMapApis(page);
  await page.goto("/map");

  await expect(page.getByText("🏔️ Всички")).toBeVisible();
  await expect(page.getByTestId("interactive-map")).toBeVisible();
});

test("smoke: login page", async ({ page }) => {
  await mockUnauthenticatedSession(page);
  await page.goto("/auth?callbackUrl=/map");
  await expect(page.getByTestId("google-signin-button")).toBeVisible();
});

test("smoke: add hazard flow", async ({ page }) => {
  await mockAuthenticatedSession(page);
  await mockMapApis(page);
  await page.goto("/map");

  await page.getByTestId("add-hazard-fab").click();
  await page.getByTestId("interactive-map").click({ position: { x: 260, y: 240 } });
  await page.fill("#hazard-description", "Тестов офлайн/онлайн сигнал");
  await page.click("button:has-text('Изпрати сигнал')");
  await expect(page.getByText("Сигналът беше изпратен успешно.")).toBeVisible();
});

test("smoke: upvote flow", async ({ page }) => {
  await mockAuthenticatedSession(page);
  await mockMapApis(page);
  await page.goto("/map");

  await page.getByTestId("filter-hazards-button").click();
  await page.locator(".leaflet-marker-icon").first().click();
  await expect(page.getByTestId("upvote-button-1")).toBeVisible();
  await page.getByTestId("upvote-button-1").click();
  await expect(page.getByText("Благодарим! Потвърждението е отчетено.")).toBeVisible();
});
