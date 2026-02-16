## **1\. v0.7 Rule Registry General Spec**

1. **Rule storage**

   * Rule definitions are small JSON blobs living **on HCS**, using **HCS-1** for chunking if needed.

   * Each concrete rule version is a single **HCS message**:  
      → addressable as `hcs://<ruleTopicId>/<sequenceNumber>`.

2. **Logical rule IDs \+ “latest” indirection**

   * A separate **Rule Registry topic** (HCS-2 “Topic Registries” style) maps  
      `ruleId` (like `sphere://alice/colors/is-red`) →  
      a concrete `ruleUri` (`hcs://.../1234`) and meta (`version`, status, etc.).

   * The registry also designates a `latest` pointer per `ruleId`.

3. **URIs & hashes in proofs**

   * Every reasoning flow uses a **full, immutable rule URI** (versioned).

   * The ReasoningContract **does not resolve the URI**, but:

     * logs `ruleUri` and

     * logs `ruleUriHash = sha256(ruleUri)`  
        so off-chain scripts can verify both the URI string and a fixed hash.

4. **Contract workflow**

   * `prepareReasoning(...)` (off-chain-driven) logs the planned `ruleUri` (+ hash) and the hashed inputs.

   * Off-chain: your script resolves `ruleUri` via mirror node, validates schema, runs inference.

   * `reason(...)` is called with (or after) the outputs; the contract logs the full **Triune proof** (inputsHash, outputsHash, binding hash, ruleUri, uriHash).

   * A separate SDK/agent submits a compact **HCS proof message** to your per-contract topic.

5. **Local-first registry**

   * Each user / sphere can have its **own pair of topics**:

     * one **RuleDefs topic** for HCS-1-style rule manifests,

     * one **RuleRegistry topic** (HCS-2-style) for `ruleId → ruleUri` mappings.

   * Only that user’s key writes; everyone can read.

6. **Offline verification**

   * An auditor with a snapshot of:

     * the RuleDefs and RuleRegistry topics,

     * the ReasoningContract logs (or mirror node view), and

     * the per-contract proof topic  
        can fully reconstruct and verify a reasoning event **offline**.

That keeps v0.7 firmly in “MVP but aligned with HCS-1 / HCS-2 / HCS-13 directions”, and it respects the fact that contracts can’t read HCS.

---

## **2\. URI & addressing model**

### **2.1 Concrete rule URIs**

**Canonical versioned rule:**

* **Address form:**  
   `hcs://<ruleTopicId>/<sequenceNumber>`

* Semantics:

  * Exactly one JSON rule definition at that `(topic, seqNo)`.

  * Immutable by construction (you never “edit” that message).

**Example:**

* RuleDefs topic: `0.0.123456`

* First version of rule: `hcs://0.0.123456/1`

* Second version: `hcs://0.0.123456/42`

You then compute:

* `ruleUriHash = sha256("hcs://0.0.123456/42")`

and include that in:

* ReasoningContract logs

* the HCS proof message

* optionally inside the rule JSON as self-check (meta profile/Sorensen layer).

### **2.2 Logical rule IDs & “latest”**

We want a stable logical rule ID plus versioned URIs.

* `ruleId`: human-readable, namespaced ID, e.g.  
   `sphere://alice/colors/is-red`  
   or more OTS/OCS flavored:  
   `ots://sphere/alice/rule/colors/is-red`

* `ruleVersion`: semver-ish string `"1.0.0"` or `"2"`, plus a monotonically increasing `versionNumber` for simple comparisons.

**Registry entries** in your RuleRegistry topic:

* `ruleId`: logical ID

* `version`: `"1.0.0"`

* `versionNumber`: `1`

* `ruleUri`: `hcs://0.0.123456/1`

* `status`: `"active" | "deprecated"`

* `isLatest`: boolean  
   (only one `true` per `ruleId` at any given time)

This gives us:

* **immutable versioned URIs** (for security-sensitive hard-coding), and

* a compact registry-level way to find “latest” when you want flexibility.

---

## **3\. Rule definition schema (conceptual)**

### **`RuleDef` (stored on HCS)**

Based on existing fields, a RuleDef would at least contain:

* Identity

  * `schema`: `"hcs.ontologic.ruleDef"`

  * `schemaVersion`: `"1"`

  * `ruleId`: logical ID (`sphere://alice/colors/is-red` style)

  * `ruleUri`: the `hcs://topic/timestamp` of this message

  * `version`: human-readable (`"1.0.0"`)

  * `versionNumber`: monotonic integer

* Semantics

  * `domain`: `"color.light"`

  * `operator`: `"mix_add@v1"`

  * `inputs`: array of input token descriptors (`{ symbol, token }` etc.)

  * `output`: output token descriptor

* Engine binding (what you already have in `rule`):

  * `engineType`: `"evm"`

  * `contractAddress`

  * `functionSelector`

  * `engineCodeHash` (your `codeHash`, maybe renamed)

* Meta

  * `createdAt`, `author` (wallet / DID)

  * `status`: `"active" | "deprecated"`

  * `ruleUriHash`: `sha256(ruleUri)`

  * `contentHash`: `sha256(canonicalJson)`

---

## **4\. Topic layout (local-first, per-sphere)**

For a single “sphere” / user:

1. **RuleDefs Topic**

   * Purpose: store concrete rule definitions (`hcs.ontologic.ruleDef` messages).

   * Access:

     * write: sphere’s wallet (local-first),

     * read: any auditor / integrator.

2. **RuleRegistry Topic**

   * Purpose: HCS-2-style registry mapping `ruleId` → `ruleUri`.

   * Each message is something like `hcs.ontologic.ruleRegistryEntry`:

     * `ruleId`

     * `version`, `versionNumber`

     * `ruleUri`

     * `ruleUriHash`

     * `status` (`active/deprecated`)

     * maybe `supersededBy` for deprecation chain.

3. **Proof Topic (per ReasoningContract)**

   * Each ReasoningContract instance (deployed per user) has its own **Proof topic**.

   * Every successful reasoning event results in an HCS message with your **Triune proof** plus `ruleUri` and `ruleUriHash`.

Everything remains local-first:

* Each user clones this pattern with **their own topics**.

* Future: you can connect these registries into higher-level OTS/OCS registries (e.g., a global OCS that references local rule registries by `hcs://` URIs).

---

## **5\. ReasoningContract responsibilities & limitations**

Because the contract can’t read HCS, here’s the contract’s “minimal but powerful” role:

### **5.1 Inputs it sees**

On-chain, the ReasoningContract can see:

* `ruleUri` (string or bytes)

* `ruleUriHash` (bytes32)

* `inputsHash`

* `outputsHash`

* `bindingHash` (your Triune proof binding of rule+inputs+outputs)

* caller address

* contract’s own address

It **cannot**:

* pull the rule JSON from HCS,

* query mirror nodes,

* validate JSON Schema.

### **5.2 Proposed function-level behavior (spec only)**

You already like this pattern:

1. **`prepareReasoning`**

   * Parameters: `ruleUri`, `ruleUriHash`, maybe `inputsHash`.

   * Contract:

     * verifies `sha256(ruleUri) == ruleUriHash` (cheap hash check),

     * optionally enforces:

       * `ruleUri` starts with `"hcs://"` and roughly matches `topicId/seq` pattern,

     * emits an event / log:

       * `Prepared(ruleUri, ruleUriHash, inputsHash, caller, timestamp)`.

2. **Off-chain step**

   * Using `ruleUri`, your off-chain script:

     * fetches the HCS message via mirror node,

     * validates the payload against HCS-13 schemas,

     * checks `ruleUriHash` and `contentHash`,

     * runs the actual reasoning / inference,

     * computes `outputsHash` and `bindingHash`.

3. **`reason`**

   * Parameters: `ruleUri`, `ruleUriHash`, `inputsHash`, `outputsHash`, `bindingHash`.

   * Contract:

     * re-checks `sha256(ruleUri) == ruleUriHash`,

     * re-checks `inputsHash` matches what was used in `prepareReasoning` (if you want that strict pairing),

     * emits event:

       * `Reasoned(ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash, caller, timestamp)`.

4. **Off-chain proof anchor**

   * After `reason` succeeds, the off-chain script submits an **HCS proof message** to the Proof topic:

     * includes `schema: "hcs.ontologic.morphemeProof"` (or similar),

     * includes `ruleUri`, `ruleUriHash`,

     * includes `inputsHash`, `outputsHash`, `bindingHash`,

     * includes `reasoningContractId`, `callerAccountId`.

That keeps the contract’s **gas footprint small** and its role crystal clear: it’s the anchor for **who** called **what** rule with **which hashes**, and HCS holds the cross-chain-notary layer.

### **5.3 On-chain validation scope (your Q19)**

Given the constraints, the contract can still do some useful checking:

* **Syntactic scheme validation**:

  * `require` prefix `hcs://`

  * parse `(topicId, seqNo)` if you want some basic guard-rails.

* **Hash consistency**:

  * `require(sha256(ruleUri) == ruleUriHash)`.

* **Provenance by contract**:

  * Because you’re local-first, the mere fact that it’s *this* ReasoningContract emitting the event is part of provenance; you don’t need HCS-level provenance checks yet.

Deeper checks (“does this URI exist on HCS?”, “does the payload match HCS-13 schema?”) all live **off-chain in your JS/TS scripts**, which is fine for v0.7 and hackathon scope.

---

## **6\. HCS proof message schema (v0.7)**

You already have the Triune pipeline; we just enrich the HCS payload.

For each successful reasoning event, a proof topic message could look roughly like:

* `schema`: `"hcs.ontologic.morphemeProof"`

* `schemaVersion`: `"1"`

* **Rule reference**

  * `ruleUri`

  * `ruleUriHash`

  * `ruleId` (optional denormalization, helps queries)

  * `ruleSchemaRef` (explicit pointer to the rule-def schema, as you requested)

* **Hashes**

  * `inputsHash`

  * `outputsHash`

  * `bindingHash`

* **Contract context**

  * `reasoningContractId`

  * `callerAccountId`

  * `chainId` / network name (if you ever go multi-net)

* **Timestamps / sequence**

  * `createdAt` (client timestamp)

  * plus the implicit HCS consensus timestamp & sequence number.

Inputs/outputs themselves remain **off-chain** (or in some other HCS-1 file anchor) since you said they’re relatively small text but you’re already hashing them.

---

## **7\. Versioning semantics**

What you described maps nicely to:

* **Concrete URIs are immutable**

  * `hcs://0.0.123456/1`, `hcs://0.0.123456/2`, etc.

* **Stable “latest” is resolved in the registry**, not by magic.

* **Proofs always point at the immutable version**, i.e. they use the concrete `hcs://.../seq` URI, not “latest”.

* Users *can* choose:

  * to **hardcode** a concrete `ruleUri` (max security), or

  * to resolve a **“latest”** rule via your registry first, then feed the concrete URI into the contract.

That gives you exactly what you want from Q25–26: both strong guarantees *and* upgradability when desired.

---

## **8\. Future extensibility: OTS / OCS, query APIs, multi-registry**

You explicitly called out future goals, so here’s how this v0.7 spec sets you up:

1. **OTS / Ontologic Technical Standards**

   * Your rule docs & registries are just **HCS-1 \+ HCS-2 \+ HCS-13** payloads with your own schema names.

   * OTS can standardize the exact schemas (`hcs.ontologic.ruleDef`, `hcs.ontologic.ruleRegistryEntry`, `hcs.ontologic.morphemeProof`).

2. **OCS / Ontologic Community Standards**

   * Community ontologies, taxonomies, etc. can live in **their own HCS topics**, registered via HCS-13, and referenced from rule definitions by `inputSchemaRef` / `outputSchemaRef` / `ontologyRef`.

   * Your logical `ruleId` namespaces (`sphere://`, `ots://`, `ocs://`) fit nicely into that.

3. **Multi-registry**

   * Because everything is `hcs://topic/seq`, a rule in another project’s registry is just another HCS topic; your ReasoningContract and scripts don’t care who “owns” the topic.

   * You can later define a higher-order “registry-of-registries” (very HCS-21-ish) that lists which topics are valid rule registries.

4. **Query APIs (REST / GraphQL) later**

   * Even if you don’t ship a query API now, if each registry entry has:

     * `ruleId`,

     * `tags`,

     * `engineType`,

     * `status`,  
        then anyone can build an indexer or subgraph that mirrors HCS and exposes:

       * “search rules by tag”,

       * “show all versions of rule X”,

       * “show all rules used by ReasoningContract Y”.

No changes to the on-chain / HCS format will be needed to add that; just index on top.

---

## **9\. What we’ve effectively “locked in” (spec-level)**

Based on your answers, here’s what I’d treat as **design decisions** for v0.7:

* ✅ **Rule location**: rules live on **HCS** (HCS-1), not a website or external DB.

* ✅ **Addressing**: primary concrete rule references are `hcs://<topic>/<seq>` URIs.

* ✅ **Logical ID \+ versioned URIs**: `ruleId` \+ `version` \+ immutable `ruleUri`, with a registry-managed “latest”.

* ✅ **Content addressing**: `sha256(ruleUri)` and optionally `sha256(canonicalJson)` recorded for each rule.

* ✅ **Local-first**: per-sphere RuleDefs \+ RuleRegistry topics, sphere-controlled writes, global read.

* ✅ **Contract limitations accepted**: ReasoningContract **does not read** from HCS or mirror nodes; it only validates cheap invariants and emits logs.

* ✅ **Two-step flow**: `prepareReasoning(...)` → off-chain resolution \+ reasoning → `reason(...)` \+ HCS proof submit.

* ✅ **Per-contract proof topics**: each ReasoningContract has a dedicated HCS topic for Triune proofs.

* ✅ **Explicit schema refs**: rule definitions & proofs reference schema URIs (HCS-13) explicitly.

If you want, the next step we can do together is:

* Sketch a **concrete JSON example** of:

  * one `ruleDef`,

  * one `ruleRegistryEntry`,

  * one `morphemeProof` message,

* plus a short "resolution algorithm" spec: given a `ruleUri`, how does a verifier fetch, validate, and recompute the proof.

---

## **10. Concrete JSON Examples**

This section provides complete, production-ready JSON examples for all v0.7 message types.
Token addresses and topic IDs reference the existing testnet deployment from v0.6.3.

### **10.1 RuleDef: RED + GREEN → YELLOW**

```json
{
  "schema": "hcs.ontologic.ruleDef",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/light/red-green-yellow",
  "ruleUri": "hcs://0.0.7250000/1763200000.000000000",
  "version": "1.0.0",
  "versionNumber": 1,
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {
      "label": "A",
      "tokenSymbol": "RED",
      "tokenId": "0.0.7247682",
      "tokenAddr": "0x00000000000000000000000000000000006e9742"
    },
    {
      "label": "B",
      "tokenSymbol": "GREEN",
      "tokenId": "0.0.7247683",
      "tokenAddr": "0x00000000000000000000000000000000006e9743"
    }
  ],
  "output": {
    "tokenSymbol": "YELLOW",
    "tokenId": "0.0.7247769",
    "tokenAddr": "0x00000000000000000000000000000000006e9799",
    "amount": "1"
  },
  "relation": "A+B→C",
  "engineType": "evm",
  "contractAddress": "0x00000000000000000000000000000000006ecc8a",
  "functionSelector": "0xc687cfeb",
  "engineCodeHash": "0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd",
  "createdAt": "2025-02-16T00:00:00.000Z",
  "author": "0.0.7238571",
  "status": "active",
  "ruleUriHash": "0x...",
  "contentHash": "0x..."
}
```

**Notes:**
- `ruleUri` is set **after** HCS submission using the consensus timestamp
- `ruleUriHash` = `sha256("hcs://0.0.7250000/1763200000.000000000")`
- `contentHash` = `sha256(canonicalJSON)` computed via RFC 8785 (sorted keys, no whitespace)
- `relation` matches v0.6.3 proof format for continuity

### **10.2 RuleDef: GREEN + BLUE → CYAN**

```json
{
  "schema": "hcs.ontologic.ruleDef",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/light/green-blue-cyan",
  "ruleUri": "hcs://0.0.7250000/1763200001.000000000",
  "version": "1.0.0",
  "versionNumber": 1,
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {
      "label": "A",
      "tokenSymbol": "GREEN",
      "tokenId": "0.0.7247683",
      "tokenAddr": "0x00000000000000000000000000000000006e9743"
    },
    {
      "label": "B",
      "tokenSymbol": "BLUE",
      "tokenId": "0.0.7247684",
      "tokenAddr": "0x00000000000000000000000000000000006e9744"
    }
  ],
  "output": {
    "tokenSymbol": "CYAN",
    "tokenId": "0.0.7247778",
    "tokenAddr": "0x00000000000000000000000000000000006e97a2",
    "amount": "1"
  },
  "relation": "A+B→C",
  "engineType": "evm",
  "contractAddress": "0x00000000000000000000000000000000006ecc8a",
  "functionSelector": "0xc687cfeb",
  "engineCodeHash": "0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd",
  "createdAt": "2025-02-16T00:00:01.000Z",
  "author": "0.0.7238571",
  "status": "active",
  "ruleUriHash": "0x...",
  "contentHash": "0x..."
}
```

### **10.3 RuleDef: RED + BLUE → MAGENTA**

```json
{
  "schema": "hcs.ontologic.ruleDef",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/light/red-blue-magenta",
  "ruleUri": "hcs://0.0.7250000/1763200002.000000000",
  "version": "1.0.0",
  "versionNumber": 1,
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {
      "label": "A",
      "tokenSymbol": "RED",
      "tokenId": "0.0.7247682",
      "tokenAddr": "0x00000000000000000000000000000000006e9742"
    },
    {
      "label": "B",
      "tokenSymbol": "BLUE",
      "tokenId": "0.0.7247684",
      "tokenAddr": "0x00000000000000000000000000000000006e9744"
    }
  ],
  "output": {
    "tokenSymbol": "MAGENTA",
    "tokenId": "0.0.7247782",
    "tokenAddr": "0x00000000000000000000000000000000006e97a6",
    "amount": "1"
  },
  "relation": "A+B→C",
  "engineType": "evm",
  "contractAddress": "0x00000000000000000000000000000000006ecc8a",
  "functionSelector": "0xc687cfeb",
  "engineCodeHash": "0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd",
  "createdAt": "2025-02-16T00:00:02.000Z",
  "author": "0.0.7238571",
  "status": "active",
  "ruleUriHash": "0x...",
  "contentHash": "0x..."
}
```

### **10.4 RuleDef: WHITE Entity (Floridi Layer)**

```json
{
  "schema": "hcs.ontologic.ruleDef",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/entity/white-from-cmy",
  "ruleUri": "hcs://0.0.7250000/1763200003.000000000",
  "version": "1.0.0",
  "versionNumber": 1,
  "domain": "color.entity.light",
  "operator": "attest_palette@v1",
  "inputs": [
    {
      "label": "evidence",
      "description": "Three CMY proof hashes",
      "evidenceRefs": [
        "sphere://demo/light/red-green-yellow",
        "sphere://demo/light/green-blue-cyan",
        "sphere://demo/light/red-blue-magenta"
      ]
    }
  ],
  "output": {
    "tokenSymbol": "WHITE",
    "tokenId": "0.0.7261514",
    "tokenAddr": "0x00000000000000000000000000000000006ecd4a",
    "amount": "1"
  },
  "relation": "YELLOW+CYAN+MAGENTA→WHITE",
  "engineType": "evm",
  "contractAddress": "0x00000000000000000000000000000000006ecc8a",
  "functionSelector": "0x...",
  "engineCodeHash": "0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd",
  "createdAt": "2025-02-16T00:00:03.000Z",
  "author": "0.0.7238571",
  "status": "active",
  "ruleUriHash": "0x...",
  "contentHash": "0x..."
}
```

**Notes:**
- Entity rules use `evidenceRefs` pointing to prerequisite rule IDs
- Domain is `color.entity.light` (Floridi layer)
- Operator is `attest_palette@v1`

### **10.5 RuleRegistryEntry Example**

```json
{
  "schema": "hcs.ontologic.ruleRegistryEntry",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/light/red-green-yellow",
  "version": "1.0.0",
  "versionNumber": 1,
  "ruleUri": "hcs://0.0.7250000/1763200000.000000000",
  "ruleUriHash": "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  "status": "active",
  "isLatest": true,
  "supersededBy": null,
  "createdAt": "2025-02-16T00:01:00.000Z"
}
```

**Version Upgrade Example:**

When releasing v1.1.0 of a rule:

```json
{
  "schema": "hcs.ontologic.ruleRegistryEntry",
  "schemaVersion": "1",
  "ruleId": "sphere://demo/light/red-green-yellow",
  "version": "1.1.0",
  "versionNumber": 2,
  "ruleUri": "hcs://0.0.7250000/1763300000.000000000",
  "ruleUriHash": "0x...",
  "status": "active",
  "isLatest": true,
  "supersededBy": null,
  "createdAt": "2025-02-17T00:00:00.000Z"
}
```

The previous entry (v1.0.0) should be updated with:
- `isLatest`: `false`
- `supersededBy`: `"hcs://0.0.7250000/1763300000.000000000"`

### **10.6 MorphemeProof v0.7 Example**

```json
{
  "schema": "hcs.ontologic.morphemeProof",
  "schemaVersion": "0.7",
  "ruleId": "sphere://demo/light/red-green-yellow",
  "ruleUri": "hcs://0.0.7250000/1763200000.000000000",
  "ruleUriHash": "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  "ruleSchemaRef": "hcs://0.0.7250001/1",
  "inputsHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "outputsHash": "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
  "bindingHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "reasoningContractId": "0.0.7261322",
  "callerAccountId": "0.0.7238571",
  "network": "hedera-testnet",
  "createdAt": "2025-02-16T00:05:00.000Z"
}
```

**Hash Computation:**
- `inputsHash` = `keccak256(canonicalJSON({inputs array}))`
- `outputsHash` = `keccak256(canonicalJSON({output object}))`
- `bindingHash` = `keccak256(canonicalJSON({ruleUri, inputsHash, outputsHash}))`

---

## **11. Resolution Algorithms**

### **11.1 Algorithm: ruleUri → RuleDef**

Given a concrete `ruleUri` (e.g., `hcs://0.0.7250000/1763200000.000000000`), resolve to the full RuleDef:

```
FUNCTION resolveRuleDef(ruleUri: string) → RuleDef

1. PARSE ruleUri
   - Extract scheme: "hcs"
   - Extract topicId: "0.0.7250000"
   - Extract timestamp: "1763200000.000000000"
   - IF scheme != "hcs" THEN ERROR "Invalid URI scheme"

2. QUERY mirror node
   - URL: GET ${MIRROR_NODE_URL}/topics/${topicId}/messages?timestamp=${timestamp}
   - Example: GET https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7250000/messages?timestamp=1763200000.000000000

3. EXTRACT message
   - response.messages[0].message (base64 encoded)
   - IF no message found THEN ERROR "RuleDef not found"

4. DECODE payload
   - messageBody = base64Decode(response.messages[0].message)
   - ruleDef = JSON.parse(messageBody)

5. VALIDATE schema
   - REQUIRE ruleDef.schema == "hcs.ontologic.ruleDef"
   - REQUIRE ruleDef.schemaVersion == "1"

6. VERIFY ruleUriHash
   - computedHash = sha256(ruleUri)
   - REQUIRE computedHash == ruleDef.ruleUriHash
   - IF mismatch THEN ERROR "ruleUriHash verification failed"

7. VERIFY contentHash
   - canonical = canonicalizeJSON(ruleDef, excluding: ["ruleUriHash", "contentHash"])
   - computedHash = sha256(canonical)
   - REQUIRE computedHash == ruleDef.contentHash
   - IF mismatch THEN ERROR "contentHash verification failed"

8. RETURN ruleDef
```

### **11.2 Algorithm: ruleId + "latest" → ruleUri**

Given a logical `ruleId` (e.g., `sphere://demo/light/red-green-yellow`), resolve to the latest concrete `ruleUri`:

```
FUNCTION resolveLatestRule(ruleId: string, registryTopicId: string) → ruleUri

1. QUERY all registry entries
   - URL: GET ${MIRROR_NODE_URL}/topics/${registryTopicId}/messages?limit=100
   - Paginate if necessary (follow next link)

2. FILTER by ruleId
   - entries = []
   - FOR each message in response:
       - payload = base64Decode(message.message)
       - entry = JSON.parse(payload)
       - IF entry.schema == "hcs.ontologic.ruleRegistryEntry"
          AND entry.ruleId == ruleId
          AND entry.status == "active":
           - entries.push(entry)

3. FIND latest
   - IF any entry has isLatest == true:
       - selectedEntry = entries.find(e => e.isLatest == true)
   - ELSE:
       - selectedEntry = entries.reduce((max, e) =>
           e.versionNumber > max.versionNumber ? e : max)

4. IF no entries found THEN ERROR "Rule not found: ${ruleId}"

5. RETURN selectedEntry.ruleUri
```

### **11.3 Algorithm: Verify MorphemeProof**

Given a MorphemeProof message, verify its integrity:

```
FUNCTION verifyMorphemeProof(proof: MorphemeProof) → boolean

1. RESOLVE RuleDef
   - ruleDef = resolveRuleDef(proof.ruleUri)
   - IF error THEN RETURN false

2. VERIFY ruleUriHash
   - computed = sha256(proof.ruleUri)
   - REQUIRE computed == proof.ruleUriHash

3. VERIFY bindingHash
   - bindingPayload = canonicalizeJSON({
       ruleUri: proof.ruleUri,
       inputsHash: proof.inputsHash,
       outputsHash: proof.outputsHash
     })
   - computed = keccak256(bindingPayload)
   - REQUIRE computed == proof.bindingHash

4. VERIFY contract event exists
   - Query mirror node for contract logs
   - Find Reasoned event with matching bindingHash
   - REQUIRE event exists and caller matches proof.callerAccountId

5. VERIFY token mint (if applicable)
   - Query mirror node for token mint transaction
   - REQUIRE output token was minted as expected

6. RETURN true (all checks passed)
```

---

## **12. Client Workflows (Milestone 3)**

This section specifies the v0.7 scripts that will be implemented. Each script is described as a workflow with inputs, steps, and outputs.

### **12.1 scripts/v07/create_sphere.js**

**Purpose**: Initialize a new sphere with all required HCS topics and a ReasoningContractV07 instance.

**Inputs:**
- `sphereName`: Human-readable name (e.g., "demo")
- `operatorId`: Hedera account ID
- `operatorKey`: Private key for signing

**Outputs:**
- Three new HCS topics created
- One new ReasoningContractV07 deployed
- Configuration saved to `config.sphere-<name>.json`

**Workflow:**
```
1. Create RULE_DEFS_TOPIC
   - TopicCreateTransaction
   - submitKey = operatorKey
   - memo = "ontologic:v0.7:ruleDefs:<sphereName>"

2. Create RULE_REGISTRY_TOPIC
   - TopicCreateTransaction
   - submitKey = operatorKey
   - memo = "ontologic:v0.7:ruleRegistry:<sphereName>"

3. Create PROOF_TOPIC
   - TopicCreateTransaction
   - submitKey = operatorKey (or contract key)
   - memo = "ontologic:v0.7:proofs:<sphereName>"

4. Deploy ReasoningContractV07
   - Upload bytecode via FileCreateTransaction
   - ContractCreateTransaction with adminKey = operatorKey

5. Save configuration
   - Write config.sphere-<sphereName>.json:
     {
       "sphereName": "demo",
       "ruleDefsTopicId": "0.0.XXXXXX",
       "ruleRegistryTopicId": "0.0.XXXXXX",
       "proofTopicId": "0.0.XXXXXX",
       "contractId": "0.0.XXXXXX",
       "contractAddr": "0x...",
       "createdAt": "2025-02-16T..."
     }
```

### **12.2 scripts/v07/publish_rule.js**

**Purpose**: Publish a RuleDef to the RULE_DEFS_TOPIC.

**Inputs:**
- `ruleDefPath`: Path to JSON file with rule definition (without ruleUri/hashes)
- `sphereConfig`: Path to sphere configuration

**Outputs:**
- RuleDef submitted to HCS
- ruleUri computed and logged
- Optionally: RuleRegistryEntry created

**Workflow:**
```
1. Load rule definition JSON
   - Parse JSON file
   - Validate required fields (domain, operator, inputs, output)

2. Add metadata
   - Set createdAt = new Date().toISOString()
   - Set author = config.OPERATOR_ID

3. Submit to HCS
   - TopicMessageSubmitTransaction to RULE_DEFS_TOPIC
   - Wait for receipt

4. Compute ruleUri
   - ruleUri = `hcs://${topicId}/${consensusTimestamp}`
   - ruleUriHash = sha256(ruleUri)

5. Update rule definition
   - Add ruleUri, ruleUriHash
   - Compute contentHash = sha256(canonicalJSON)
   - Note: The on-chain version doesn't have these; they're computed after

6. Optionally create registry entry
   - If --register flag:
       - Create RuleRegistryEntry with isLatest=true
       - Submit to RULE_REGISTRY_TOPIC

7. Output
   - Log ruleUri, ruleUriHash, contentHash
   - Save to output file if specified
```

### **12.3 scripts/v07/register_rule_version.js**

**Purpose**: Create or update a RuleRegistryEntry mapping ruleId → ruleUri.

**Inputs:**
- `ruleId`: Logical rule ID (e.g., `sphere://demo/light/red-green-yellow`)
- `version`: Version string (e.g., "1.0.0")
- `ruleUri`: Concrete HCS URI
- `isLatest`: Whether this is the latest version (default: true)

**Workflow:**
```
1. Verify RuleDef exists
   - Resolve ruleUri via mirror node
   - Validate it's a valid RuleDef

2. Create RuleRegistryEntry
   - schema: "hcs.ontologic.ruleRegistryEntry"
   - schemaVersion: "1"
   - ruleId, version, ruleUri
   - versionNumber = parse from version or auto-increment
   - ruleUriHash = sha256(ruleUri)
   - status = "active"
   - isLatest = true (or false if updating old)

3. Submit to RULE_REGISTRY_TOPIC
   - TopicMessageSubmitTransaction

4. Update previous "latest" (optional)
   - If replacing existing latest, submit update entry
   - Set previous isLatest = false
   - Set supersededBy = new ruleUri
```

### **12.4 scripts/v07/reason.js**

**Purpose**: Execute a complete v0.7 reasoning flow.

**Inputs:**
- `bundlePath`: Path to reasoning bundle JSON (similar to v0.6.3 format)
- `ruleRef`: Either ruleId (resolve latest) or ruleUri (use directly)
- `sphereConfig`: Path to sphere configuration

**Workflow:**
```
1. Resolve rule
   - IF ruleRef starts with "hcs://":
       - ruleUri = ruleRef
   - ELSE:
       - ruleUri = resolveLatestRule(ruleRef, RULE_REGISTRY_TOPIC)
   - ruleDef = resolveRuleDef(ruleUri)
   - Verify hashes

2. Load and validate inputs
   - Parse bundle JSON
   - Verify input tokens match ruleDef.inputs
   - Compute inputsHash = keccak256(canonicalJSON(inputs))

3. Call prepareReasoning
   - ContractExecuteTransaction
   - prepareReasoning(ruleUri, ruleUriHash, inputsHash)
   - Wait for receipt

4. Execute reasoning logic
   - Off-chain: determine output based on ruleDef
   - For color rules: apply additive mixing logic
   - Compute outputsHash = keccak256(canonicalJSON(output))

5. Compute bindingHash
   - bindingPayload = { ruleUri, inputsHash, outputsHash }
   - bindingHash = keccak256(canonicalJSON(bindingPayload))

6. Call reason
   - ContractExecuteTransaction
   - reason(ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash)
   - Contract mints output token

7. Build MorphemeProof v0.7
   - schema: "hcs.ontologic.morphemeProof"
   - Include all hashes and context

8. Submit to PROOF_TOPIC
   - TopicMessageSubmitTransaction

9. Output
   - Log proof hash, HCS sequence, transaction IDs
```

### **12.5 scripts/v07/validate-light-e2e-v07.js**

**Purpose**: Validate the complete v0.7 proof chain for the four canonical color rules.

**Workflow:**
```
1. Verify RULE_DEFS_TOPIC
   - Query all messages
   - Find 4 RuleDef messages for canonical rules
   - Verify each has valid schema, hashes

2. Verify RULE_REGISTRY_TOPIC
   - Query all messages
   - Find 4 RuleRegistryEntry messages
   - Verify each maps to correct ruleUri
   - Verify isLatest flags

3. Verify PROOF_TOPIC
   - Query all MorphemeProof messages
   - For each proof:
       - Resolve ruleDef
       - Verify bindingHash computation
       - Match with contract events

4. Verify contract state
   - Query ReasoningContractV07 logs
   - Match Prepared and Reasoned events
   - Verify proofSeen mapping entries

5. Verify token mints
   - Query token balances
   - Confirm YELLOW, CYAN, MAGENTA, WHITE minted

6. Cross-validate hashes
   - For each proof:
       - Recompute inputsHash from inputs
       - Recompute outputsHash from output
       - Recompute bindingHash
       - Verify all match stored values

7. Output validation report
   - List all verified proofs
   - Flag any inconsistencies
```

---

## **13. Example Data & Migration (Milestone 4)**

### **13.1 Canonical Rule Definitions**

The following four rules migrate the v0.6.3 hardcoded logic to v0.7 HCS-based definitions:

| v0.6.3 Rule | v0.7 ruleId | Domain | Operator |
|-------------|-------------|--------|----------|
| RED+GREEN→YELLOW | `sphere://demo/light/red-green-yellow` | `color.light` | `mix_add@v1` |
| GREEN+BLUE→CYAN | `sphere://demo/light/green-blue-cyan` | `color.light` | `mix_add@v1` |
| RED+BLUE→MAGENTA | `sphere://demo/light/red-blue-magenta` | `color.light` | `mix_add@v1` |
| WHITE entity | `sphere://demo/entity/white-from-cmy` | `color.entity.light` | `attest_palette@v1` |

### **13.2 Migration Strategy**

**Principle**: v0.6.3 remains frozen. v0.7 is a parallel system.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Migration Overview                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  v0.6.3 (FROZEN)              v0.7 (NEW)                            │
│  ─────────────────            ──────────                            │
│  Contract: 0.0.7261322        Contract: 0.0.XXXXXX (new deploy)     │
│  HCS Topic: 0.0.7239064       Topics: 3 new topics                  │
│  Rules: Hardcoded             Rules: HCS-based RuleDefs             │
│  Proofs: Seq 33-42            Proofs: New sequences                 │
│  Tokens: Existing             Tokens: Reuse existing                │
│                                                                      │
│  NO CHANGES                   NEW PARALLEL SYSTEM                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Step-by-Step Migration:**

1. **Create v0.7 sphere**
   ```bash
   node scripts/v07/create_sphere.js --name demo
   ```

2. **Publish RuleDefs**
   ```bash
   node scripts/v07/publish_rule.js examples/v07/ruleDef-red-green-yellow.json --register
   node scripts/v07/publish_rule.js examples/v07/ruleDef-green-blue-cyan.json --register
   node scripts/v07/publish_rule.js examples/v07/ruleDef-red-blue-magenta.json --register
   node scripts/v07/publish_rule.js examples/v07/ruleDef-white-entity.json --register
   ```

3. **Migrate supply keys** (if using new contract)
   ```bash
   node scripts/migrate-supply-keys-v07.js
   ```

4. **Execute proofs**
   ```bash
   node scripts/v07/reason.js examples/mvp/red-green-yellow.json --rule sphere://demo/light/red-green-yellow
   ```

5. **Validate**
   ```bash
   node scripts/v07/validate-light-e2e-v07.js
   ```

### **13.3 Provenance Linkage**

v0.7 RuleDefs can reference v0.6.3 code hashes for provenance continuity:

```json
{
  "schema": "hcs.ontologic.ruleDef",
  "...": "...",
  "engineCodeHash": "0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd",
  "provenance": {
    "migratedFrom": "v0.6.3",
    "originalContract": "0.0.7261322",
    "originalHcsSeqs": [39, 40, 41, 42]
  }
}
```

### **13.4 Token Reuse**

The existing tokens (RED, GREEN, BLUE, YELLOW, CYAN, MAGENTA, WHITE, BLACK) are reused:

| Token | Token ID | EVM Address | Supply Key |
|-------|----------|-------------|------------|
| RED | 0.0.7247682 | 0x...6e9742 | Operator |
| GREEN | 0.0.7247683 | 0x...6e9743 | Operator |
| BLUE | 0.0.7247684 | 0x...6e9744 | Operator |
| YELLOW | 0.0.7247769 | 0x...6e9799 | Contract* |
| CYAN | 0.0.7247778 | 0x...6e97a2 | Contract* |
| MAGENTA | 0.0.7247782 | 0x...6e97a6 | Contract* |
| WHITE | 0.0.7261514 | 0x...6ecd4a | Contract* |
| BLACK | 0.0.7261517 | 0x...6ecd4d | Contract* |

*Supply keys for CMY/WHITE/BLACK need migration to v0.7 contract.

---

## **14. Future Work (Milestone 6)**

### **14.1 OTS (Ontologic Technical Standards)**

OTS will formalize the message schemas defined in v0.7:

| Schema | OTS Number | Status |
|--------|------------|--------|
| `hcs.ontologic.ruleDef` | OTS-001 | Draft |
| `hcs.ontologic.ruleRegistryEntry` | OTS-002 | Draft |
| `hcs.ontologic.morphemeProof` | OTS-003 | Draft |

**Standardization Path:**
1. Freeze v0.7 schemas after validation
2. Publish OTS specifications to Ontologic GitHub
3. Register schemas via HCS-13 on mainnet
4. Assign stable OTS numbers

### **14.2 OCS (Ontologic Community Standards)**

OCS enables community-defined extensions:

**Namespace Conventions:**
- `sphere://` - Local/personal rule spaces
- `ots://` - Official Ontologic Technical Standards
- `ocs://` - Community-contributed standards

**Example:**
```
ocs://community/finance/compliance/kyc-check@v1
```

**Extensibility Fields:**
RuleDefs can include optional OCS references:

```json
{
  "...": "...",
  "ontologyRef": "ocs://community/taxonomies/financial-instruments",
  "inputSchemaRef": "hcs://0.0.XXXXXX/1",
  "outputSchemaRef": "hcs://0.0.XXXXXX/2",
  "tags": ["finance", "compliance", "kyc"]
}
```

### **14.3 Query APIs**

Future indexer/subgraph can expose:

- `GET /rules?domain=color.light` - Search rules by domain
- `GET /rules/{ruleId}/versions` - List all versions
- `GET /proofs?contract=0.0.XXXXXX` - List proofs by contract
- `GET /verify/{bindingHash}` - Verify a proof

### **14.4 Multi-Registry Federation**

Multiple spheres can federate via a "registry-of-registries":

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Registry Federation                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Sphere A    │  │  Sphere B    │  │  Sphere C    │              │
│  │  Registry    │  │  Registry    │  │  Registry    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│         └─────────────────┼─────────────────┘                        │
│                           │                                          │
│                    ┌──────▼───────┐                                  │
│                    │   OTS/OCS    │                                  │
│                    │   Registry   │                                  │
│                    │  (Global)    │                                  │
│                    └──────────────┘                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### **14.5 Cross-Domain Reasoning**

Future versions may support:

- Rules that span multiple domains
- Chained reasoning (output of one rule feeds input of another)
- Conditional rules based on external data

---

## **Document Status**

| Section | Status | Last Updated |
|---------|--------|--------------|
| 1-9 | Complete | 2025-02-16 |
| 10. Concrete Examples | Complete | 2025-02-16 |
| 11. Resolution Algorithms | Complete | 2025-02-16 |
| 12. Client Workflows | Spec Only | 2025-02-16 |
| 13. Migration | Spec Only | 2025-02-16 |
| 14. Future Work | Anchors Only | 2025-02-16 |

**Related Documents:**
- [architecture-v07.md](architecture-v07.md) - v0.7 architecture overview
- [architecture.md](architecture.md) - v0.6.3 frozen reference

