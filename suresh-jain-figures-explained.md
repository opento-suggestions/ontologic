# Semantic Color Transformation and Structural Framework
**Based on: Semantic Driven Automated Image Processing using the Concept of Colorimetry (Suresha & Jain, 2015)**

## Part 1: The CMYK <-> RGB Transformation

### The Philosophical Grounding
Historically, digital image processing has relied on raw pixel-level math (like histograms or static matrix multiplications) to transform colors. As the Suresha & Jain paper outlines, these older methods "fail to incorporate semantic information, and therefore tend to give vague results." 

To bridge the gap between additive light (RGB) and subtractive material (CMYK), the transformation must move beyond simple numbers and enter the realm of **Colorimetry** mapped via the **Semantic Web**.

### The Ontological Transformation
Rather than using a raw mathematical formula, the paper proposes handling the CMYK <-> RGB relationship through a structured Web Ontology Language (OWL) format.

The transformation is understood through interdependencies in the ontology:
1. **Shared Parentage:** Both `CMYK` and `RGB` are defined as Sub-classes of the `ColorModes` class, which is itself a descriptor of the parent `Color` class.
2. **Semantic Coordinates:** Instead of calculating values on the fly, the system relies on predefined relationships (the `hasCoordinate` property). 
3. **The Root Reference:** Both systems are conceptually anchored to the `XYZ` color space, which the paper identifies as the "root of all colorimetry." 

### Conclusion
By presenting these models over a semantic web platform, the transformation between CMYK and RGB ceases to be a blind calculation. It becomes an "automated decision making tool." The system understands that CMYK (representing scanning/printing inks) and RGB (representing CRT/display light) are physically distinct aspects of color, but mathematically linked through their shared semantic coordinates in the overarching Color Ontology.

---

## Part 2: Figure Descriptions (Non-Visual Structural Map)

The Suresh & Jain paper relies heavily on visual figures to prove its technical implementation. Without viewing them, the actual class hierarchy, query syntax, and UI proof-of-concept are lost. Below are the structural descriptions of those figures.

### Figure 1: The Image Raster Diagram
This diagram explains how a physical screen translates to computer memory. 
* **The Left Side (Visual):** It displays a large rectangle labeled "Image Raster." Inside is a grid, like a piece of graph paper. The very top-left square in the grid is colored solid black and is labeled with the coordinates `(0, 0)`. The square immediately below it is `(0, 1)`. The top edge is labeled "Width (W)" and the right edge is labeled "Height (H)". An arrow points from this grid to the right side of the diagram.
* **The Right Side (Memory):** It shows a vertical table acting as a memory array. It has two columns: "Address Offset" (the index) and "Value" (the color data). Address `0` holds the value `128`. Address `1` holds `0`. Address `2` holds `128`. Address `3` holds `255`. 
* **The Context:** A note on the side explains this represents an "8-bit Greyscale frame buffer," where a value of `0` equals solid black, and `255` equals solid white. 

### Figure 2: Color Classes Box Diagram
This is a very simple, flat flowchart demonstrating relationships. 
* On the far left, a rectangular box labeled **Quality** points with a dashed arrow to a box labeled **Color**. 
* **Color** points with a dashed arrow to a central box labeled **Color Modes**.
* From this central **Color Modes** box, six dashed arrows branch outward in a starburst pattern to six separate, independent boxes: **RGB**, **CMYK**, **LAB**, **XYZ**, **HSL**, and **HSB**. 

### Figure 3: The Protégé Class Tree
This image is a screenshot of a software interface (Protégé), displaying the ontology as a hierarchical directory tree, exactly like files and folders on a computer.
* The root folder is **Thing**.
* Inside Thing is a folder called **Quality**.
* Inside Quality is a folder called **Colour** (which is highlighted).
* Inside Colour, there is a flat list of items (descriptors): `ColourLayoutDescriptor`, `ColourQuantizationDescriptor`, `ColourSpaceDescriptor`, `ColourStructureDescriptor`, and `DominantColourDescriptor`. 
* Also inside Colour is a folder named **ColourModes**. This folder is expanded to reveal the specific color space models inside it: `XYZ`, `LAB`, `CMYK`, `HSB`, `HSL`, and `RGB`. 

### Figure 4: The Logic Algorithm
This is a block of pseudo-code written in italicized text outlining a procedure called `Render Image ()`. 
* It describes a loop that goes through "each pixel on the Image."
* For each pixel, it moves a cursor to that position, lists the coordinates of its color models, and calls a procedure to map the OWL Color Modes using the X, Y, and Z arguments. 
* Finally, it plots those returned coordinate values and moves to the next pixel.

### Figure 5: The OWL Node-and-Edge Graph
This is another screenshot from the Protégé software, but instead of a directory tree, it displays the ontology as a visual web (a directed graph).
* On the far left is the **Quality** node. An arrow points from it to the **Colour** node in the center.
* From the central **Colour** node, multiple arrows branch out pointing to the standalone descriptor nodes (like `ColourStructureDescriptor`).
* One specific arrow points from **Colour** to a node called **ColourModes**.
* From the **ColourModes** node, six final arrows branch out to the individual color model nodes: **XYZ**, **CMYK**, **HSL**, **HSB**, **LAB**, and **RGB**. This visually proves that the color models are considered subsets of `ColourModes`, rather than direct subsets of `Colour`.

### Figure 6: The SPARQL Query
This is a screenshot of a plain text code editor showing a short database query written in the SPARQL language.
* The top two lines declare the "Prefixes" (the web addresses where the RDF schema and the custom color ontology are hosted).
* Below that is a `SELECT * WHERE` block. Inside the block, three variables (`?a`, `?c`, and `?e`) are mapped to the specific Red, Green, and Blue coordinate properties defined in the ontology.

### Figure 7 (a, b, c, d): The Application UI
This is a 2x2 grid of four screenshots showing a custom desktop software application the authors built to test their ontology.
* **The Layout:** The top half of the window is filled with data entry fields showing the numerical values for RGB, HSB, HSL, and Lab at a given moment. 
* **The Visuals:** On the bottom left of the window is a large square color swatch. On the bottom right is an interactive, multi-colored color wheel with a mouse cursor clicking on it. In the bottom center is a 3D graph (a surface plot) that visualizes the color intensity data with colored peaks and valleys.
* **The Actions:** Panel (a) shows the user clicking the blue section of the color wheel, resulting in a blue swatch and a blue 3D graph. Panel (b) shows pink/magenta. Panel (c) shows red. Panel (d) shows green.

### Figure 8 (a, b, c): The Image Transformation
This figure places three panels side-by-side to demonstrate the results of running their algorithm on a real picture.
* **Panel A (Original Image):** A highly pixelated, abstract square composed of various distinct color blocks—mostly warm yellows and greens on the left, blending into deep blues and bright pinks/magentas on the right. 
* **Panel B (Transformed Image):** An image that looks visually identical to Panel A. It represents the original image after it has been fully processed and mapped through their semantic color space algorithm. 
* **Panel C (Chromaticity Diagram):** A classic 2D graph used in color science. It features a curved, horseshoe-shaped boundary line that represents the entire spectrum of human-visible light. Inside this empty horseshoe, a thick, somewhat messy red circle has been drawn. This red circle plots the exact mathematical color boundaries (the gamut) extracted from the image in Panels A and B.

=======================================================================
[FIGURE 1: Image Raster Diagram]
=======================================================================

     Image Raster                           Address Offset   Value
     Width (W)                                       (8-bit Greyscale)
   +---+---+---+---+                             +---+----------+
   |█00| 01|   |   |                             | 0 |    128   |
   +---+---+---+---+                             +---+----------+
   |   |   |   |   |      Represented by         | 1 |      0   | (█00)
   +---+---+---+---+    ----------------->       +---+----------+
   |   |   |   |   |                             | 2 |    128   |
   +---+---+---+---+                             +---+----------+
H  |   |   |   |   |                             | 3 |    255   |
e  +---+---+---+---+                             +---+----------+
i                                                |...|    ...   |
g
h
t
(H)


=======================================================================
[FIGURE 2: Color Classes Box Diagram]
=======================================================================

                                +--------+   +--------+
                                |  RGB   |   |  CMYK  |
                                +--------+   +--------+
                                     ^            ^
 +---------+      +---------+        |            |        +--------+
 | Quality | - -> |  Color  | - -> +--------------+ - - -> |  LAB   |
 +---------+      +---------+      | Color Models |        +--------+
                                   +--------------+ - - -> +--------+
                                     /       |    \        |  XYZ   |
                                    v        v     v       +--------+
                             +--------+ +--------+ +--------+
                             |  HSB   | |  HSL   | |  ...   |
                             +--------+ +--------+ +--------+


=======================================================================
[FIGURE 3: Protégé Class Tree]
=======================================================================

 ▼ [C] Thing
   ▼ [C] Quality
     ▼ [C] Colour
       |-- [C] ColourLayoutDescriptor
       ▼ [C] ColourModes
         |-- [C] CMYK
         |-- [C] HSB
         |-- [C] HSL
         |-- [C] LAB
         |-- [C] RGB
         |-- [C] XYZ
       |-- [C] ColourQuantizationDescriptor
       |-- [C] ColourSpaceDescriptor
       |-- [C] ColourStructureDescriptor
       |-- [C] DominantColourDescriptor


=======================================================================
[FIGURE 5: Color Ontology OWL (Relations between models)]
=======================================================================

                          +---------------------------+
                          | ColourStructureDescriptor |
                          +---------------------------+
                                     ^
                                     |
+---------+    +--------+ -----> +--------------------------+    +------+
| Quality | -> | Colour |        | DominantColourDescriptor |    | XYZ  |
+---------+    +--------+ -----> +--------------------------+    +------+
                 | | |                                              ^
                 | | +---------> +---------------------------+      |
                 | |             | ScalableColourDescriptor  |      |
                 | |             +---------------------------+      |
                 | |                                                |
                 | +-----------> +---------------------------+   +-------------+ ----> +------+
                 |               | ColourLayoutDescriptor    |   | ColourModes | ----> | CMYK |
                 |               +---------------------------+   +-------------+ ----> +------+
                 |                                                  ^ | |  |           | HSL  |
                 +-------------> +---------------------------+      | | |  |           +------+
                                 | ColourSpaceDescriptor     |------+ | |  +---------> +------+
                                 +---------------------------+        | |              | HSB  |
                                                                      | |              +------+
                                                                      | +------------> +------+
                                                                      |                | LAB  |
                                                                      +--------------> +------+
                                                                                       | RGB  |
                                                                                       +------+


=======================================================================
[FIGURE 6: Query for RGB Color Models]
=======================================================================

PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX color: <http://www.colormodes.com/color.owl#>

SELECT *
WHERE
{ ?a color:RGBCoordinateR ?b.
  ?c color:RGBCoordinateG ?d.
  ?e color:RGBCoordinateB ?f.
}