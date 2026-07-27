/**
 * Unit tests for convex/lms/manifest.ts — parseScormManifest.
 *
 * E03 (PDD §7.1 spec-drift FIX): the parser is STRICT. Malformed XML, wrong
 * SCORM version, and missing required structural elements throw
 * ManifestValidationError with a stable `code` discriminator. These tests
 * assert that contract — do NOT loosen the parser back to the Sprint-0
 * permissive behavior without re-opening the spec-drift ticket.
 */
import { describe, it, expect } from "vitest";
import {
  parseScormManifest,
  ManifestValidationError,
} from "../../../../convex/lms/manifest";

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

const minimalValid = (overrides?: { schemaversion?: string }) => `<?xml version="1.0"?>
<manifest identifier="M-MIN" version="1.2">
  <metadata><schemaversion>${overrides?.schemaversion ?? "1.2"}</schemaversion></metadata>
  <organizations>
    <organization identifier="O"><title>T</title>
      <item identifier="I" identifierref="R"><title>X</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R" adlcp:scormtype="sco" href="launch.html"/>
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

  it("decodes XML entities in titles", () => {
    const entities = `<?xml version="1.0"?>
<manifest identifier="X">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations>
    <organization identifier="O"><title>A &amp; B &lt;C&gt;</title></organization>
  </organizations>
  <resources><resource identifier="R" href="a.html"/></resources>
</manifest>`;
    const parsed = parseScormManifest(entities);
    expect(parsed.title).toBe("A & B <C>");
  });
});

describe("parseScormManifest — strict validation (E03 spec-drift FIX)", () => {
  it("throws ManifestValidationError with code=malformed on empty input", () => {
    expect(() => parseScormManifest("")).toThrow(ManifestValidationError);
    try {
      parseScormManifest("");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("malformed");
    }
  });

  it("throws code=malformed on non-XML garbage input", () => {
    try {
      parseScormManifest("this is not xml at all");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("malformed");
    }
  });

  it("throws code=malformed when there is no <manifest> root", () => {
    try {
      parseScormManifest("<other><thing/></other>");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("malformed");
    }
  });

  it("throws code=missing-fields when <manifest> has no identifier attr", () => {
    const noId = `<?xml version="1.0"?><manifest><metadata><schemaversion>1.2</schemaversion></metadata><organizations><organization identifier="O"/></organizations><resources><resource identifier="R" href="a.html"/></resources></manifest>`;
    try {
      parseScormManifest(noId);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("missing-fields");
    }
  });

  it("throws code=missing-fields when <schemaversion> is absent", () => {
    const noVersion = `<?xml version="1.0"?><manifest identifier="X"><metadata><schema>ADL SCORM</schema></metadata><organizations><organization identifier="O"/></organizations><resources><resource identifier="R" href="a.html"/></resources></manifest>`;
    try {
      parseScormManifest(noVersion);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("missing-fields");
    }
  });

  it("throws code=wrong-version on SCORM 2004 (schemaversion != 1.2)", () => {
    try {
      parseScormManifest(minimalValid({ schemaversion: "2004 4th Edition" }));
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("wrong-version");
    }
  });

  it("throws code=missing-fields when <organizations> is absent", () => {
    const noOrg = `<?xml version="1.0"?><manifest identifier="X"><metadata><schemaversion>1.2</schemaversion></metadata><resources><resource identifier="R" href="a.html"/></resources></manifest>`;
    try {
      parseScormManifest(noOrg);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("missing-fields");
    }
  });

  it("throws code=missing-fields when <resources> is empty", () => {
    const emptyRes = `<?xml version="1.0"?><manifest identifier="X"><metadata><schemaversion>1.2</schemaversion></metadata><organizations><organization identifier="O"><title>T</title></organization></organizations><resources></resources></manifest>`;
    try {
      parseScormManifest(emptyRes);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestValidationError);
      expect((e as ManifestValidationError).code).toBe("missing-fields");
    }
  });

  it("uses Spanish error messages with tildes", () => {
    try {
      parseScormManifest(minimalValid({ schemaversion: "2004" }));
      throw new Error("expected throw");
    } catch (e) {
      expect((e as Error).message).toMatch(/Versi.n SCORM no soportada/);
    }
  });
});

describe("parseScormManifest — entry point resolution within valid manifests", () => {
  it("falls back to the first SCO resource when items have no identifierref", () => {
    const noref = `<?xml version="1.0"?>
<manifest identifier="X">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations>
    <organization identifier="O"><title>FallbackCase</title>
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

  it("returns null entryPoint when items reference missing resources", () => {
    const orphan = `<?xml version="1.0"?>
<manifest identifier="X">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations>
    <organization identifier="O"><title>Orphaned</title>
      <item identifier="I" identifierref="MISSING"><title>Sin recurso</title></item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="R" href=""/>
  </resources>
</manifest>`;
    const parsed = parseScormManifest(orphan);
    expect(parsed.title).toBe("Orphaned");
    expect(parsed.organizations.items).toHaveLength(1);
    expect(parsed.entryPoint).toBeNull();
  });
});
