/**
 * Unit tests for convex/lms/manifest.ts — parseScormManifest.
 *
 * The parser is intentionally permissive (see file header): malformed XML
 * does NOT throw — it returns a manifest object whose fields are null or
 * empty so the calling action can surface "no entry point" via the
 * imsmanifest-not-found / entryPoint-null code paths. Tests assert that
 * exact contract; do NOT promote the regex parser to a validating one
 * without updating the ingestScormPackage action's downstream checks.
 */
import { describe, it, expect } from "vitest";
import { parseScormManifest } from "../../../../convex/lms/manifest";

const validScorm12 = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MANIFEST-1" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Diversidad, Equidad e Inclusión</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>Módulo 1 — Introducción</title>
      </item>
      <item identifier="ITEM-2" identifierref="RES-2">
        <title>Módulo 2 — Casos</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="modulo1/index.html">
      <file href="modulo1/index.html"/>
      <file href="modulo1/style.css"/>
    </resource>
    <resource identifier="RES-2" type="webcontent" adlcp:scormtype="sco" href="modulo2/index.html">
      <file href="modulo2/index.html"/>
    </resource>
  </resources>
</manifest>`;

describe("parseScormManifest — happy path (SCORM 1.2)", () => {
  const parsed = parseScormManifest(validScorm12);

  it("extracts the organization title", () => {
    expect(parsed.title).toBe("Diversidad, Equidad e Inclusión");
    expect(parsed.organizations.identifier).toBe("ORG-1");
  });

  it("extracts items in document order", () => {
    expect(parsed.organizations.items).toHaveLength(2);
    expect(parsed.organizations.items[0]).toMatchObject({
      identifier: "ITEM-1",
      identifierref: "RES-1",
      title: "Módulo 1 — Introducción",
    });
    expect(parsed.organizations.items[1].identifierref).toBe("RES-2");
  });

  it("extracts resources with scormtype + href + files", () => {
    expect(parsed.resources).toHaveLength(2);
    expect(parsed.resources[0]).toMatchObject({
      identifier: "RES-1",
      scormType: "sco",
      href: "modulo1/index.html",
    });
    expect(parsed.resources[0].files).toEqual([
      "modulo1/index.html",
      "modulo1/style.css",
    ]);
  });

  it("resolves the entry point from the first item's resource href", () => {
    expect(parsed.entryPoint).toBe("modulo1/index.html");
  });
});

describe("parseScormManifest — degraded inputs", () => {
  it("returns a manifest shell with no items and null entryPoint on empty input", () => {
    const parsed = parseScormManifest("");
    expect(parsed.title).toBeNull();
    expect(parsed.organizations.items).toEqual([]);
    expect(parsed.resources).toEqual([]);
    expect(parsed.entryPoint).toBeNull();
  });

  it("returns null entryPoint when items reference missing resources", () => {
    const orphan = `<manifest>
      <organizations>
        <organization identifier="O">
          <title>Orphaned</title>
          <item identifier="I" identifierref="MISSING">
            <title>Sin recurso</title>
          </item>
        </organization>
      </organizations>
      <resources></resources>
    </manifest>`;
    const parsed = parseScormManifest(orphan);
    expect(parsed.title).toBe("Orphaned");
    expect(parsed.organizations.items).toHaveLength(1);
    expect(parsed.entryPoint).toBeNull();
  });

  it("falls back to the first SCO resource when items have no identifierref", () => {
    const noref = `<manifest>
      <organizations>
        <organization identifier="O">
          <title>FallbackCase</title>
          <item identifier="I"><title>Sin ref</title></item>
        </organization>
      </organizations>
      <resources>
        <resource identifier="R" adlcp:scormtype="sco" href="launch.html"/>
      </resources>
    </manifest>`;
    const parsed = parseScormManifest(noref);
    expect(parsed.entryPoint).toBe("launch.html");
  });

  it("decodes XML entities in titles", () => {
    const entities = `<manifest>
      <organizations>
        <organization identifier="O">
          <title>A &amp; B &lt;C&gt;</title>
        </organization>
      </organizations>
      <resources></resources>
    </manifest>`;
    const parsed = parseScormManifest(entities);
    expect(parsed.title).toBe("A & B <C>");
  });
});
