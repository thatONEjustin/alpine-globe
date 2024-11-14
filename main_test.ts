import Globe from "./main.ts";
import { assertEquals } from "@std/assert/equals";

Deno.test(function import_globe() {
  // assertEquals(add(2, 3), 5);
  assertEquals(typeof Globe, "function");
});
