import { assert } from "@std/assert";
// import { add } from "./main.ts";
import * as globe from "./main.ts";

// import swiper from '../dist/module.esm'
// test('module import as function', () => {
//   expect(typeof swiper).toBe('function')
// })
Deno.test(function addTest() {
  // assertEquals(add(2, 3), 5);
  assert(typeof globe == "function");
});
