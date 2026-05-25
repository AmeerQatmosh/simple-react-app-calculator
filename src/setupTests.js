import "@testing-library/jest-dom/vitest";

window.matchMedia =
  window.matchMedia ||
  function mockMatchMedia(query) {
    // Treat viewport as desktop so components that use `(min-width: 861px)` show the rail;
    // `(max-width: 860px)` compact layouts stay disabled.
    const matches =
      typeof query === "string" &&
      query.includes("min-width") &&
      query.includes("861");
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    };
  };
