import assert from "node:assert/strict";
import { test } from "node:test";
import { hasThirdPartyHeader, isMinifiedBrs, isVendoredFile, isVendoredPath } from "../src/preflight/source.ts";

test("isVendoredPath detects vendor folders and components/*sdk*", () => {
  assert.equal(isVendoredPath("vendor/example-sdk/http.brs"), true);
  assert.equal(isVendoredPath("libs/example-analytics/tracker.brs"), true);
  assert.equal(isVendoredPath("lib/net.brs"), true);
  assert.equal(isVendoredPath("third_party/foo/bar.brs"), true);
  assert.equal(isVendoredPath("components/ExampleAnalyticsSdk/Main.brs"), true);
  assert.equal(isVendoredPath("components/foo-sdk/util.brs"), true);
  assert.equal(isVendoredPath("source/main.brs"), false);
  assert.equal(isVendoredPath("source/library.brs"), false);
  assert.equal(isVendoredPath("components/ExampleMainScene.brs"), false);
});

test("isVendoredPath detects vendor or sdk names at any depth, including under source/", () => {
  assert.equal(isVendoredPath("source/ExampleVendorSDK/http.brs"), true);
  assert.equal(isVendoredPath("source/ExampleVendor/http.brs"), true);
  assert.equal(isVendoredPath("source/third_party_net.brs"), true);
  assert.equal(isVendoredPath("components/Player.brs"), false);
  assert.equal(isVendoredPath("source/inventory.brs"), false);
});

test("third-party headers and minified BrightScript are treated as vendored, generic copyright is not", () => {
  const thirdParty = `' Third-party library. Copyright 2024 Example Vendor.\nsub Init()\nEnd sub\n`;
  const generic = `' Copyright 2026 Example Corp.\nsub Main()\nEnd sub\n`;
  const originally = `' Originally written by Example Vendor for this SDK.\nFunction Init() as Void\nEnd Function\n`;
  assert.equal(hasThirdPartyHeader(thirdParty), true);
  assert.equal(hasThirdPartyHeader(originally), true);
  assert.equal(hasThirdPartyHeader(generic), false);
  assert.equal(isVendoredFile("source/http.brs", thirdParty), true);
  assert.equal(isVendoredFile("source/main.brs", generic), false);

  const minified = "sub A():" + "x=1:".repeat(200) + "end sub\n";
  assert.equal(isMinifiedBrs("source/bundle.brs", minified), true);
  assert.equal(isVendoredFile("source/bundle.brs", minified), true);
  assert.equal(isMinifiedBrs("source/main.brs", "sub Main()\n    print 1\nend sub\n"), false);
});
