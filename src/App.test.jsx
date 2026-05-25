import { render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
});

test("renders a single theme switch on floating desktop tiles", () => {
  render(<App />);
  expect(
    screen.getByRole("switch", { name: /color theme/i })
  ).toBeInTheDocument();
  expect(screen.getByText(/^light$/i)).toBeInTheDocument(); // caption when default light
});
