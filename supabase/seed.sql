begin;

create temp table if not exists dh_seed_document (data jsonb);
truncate dh_seed_document;
insert into dh_seed_document (data)
values ($dh_seed${
  "divisions": [
    {
      "id": "10000000-0000-4000-8000-000000000001",
      "slug": "labels-stickers",
      "name": "Labels & stickers",
      "description": "Custom-cut labels, sheet labels and short-run sticker runs.",
      "sort": 1
    },
    {
      "id": "10000000-0000-4000-8000-000000000002",
      "slug": "race-event-numbers",
      "name": "Race & event numbers",
      "description": "Bib numbers, event boards and variable-data race artwork.",
      "sort": 2
    },
    {
      "id": "10000000-0000-4000-8000-000000000003",
      "slug": "mtb-boards",
      "name": "MTB boards",
      "description": "Custom race boards and number plates built for the trail.",
      "sort": 3
    },
    {
      "id": "10000000-0000-4000-8000-000000000004",
      "slug": "stamps",
      "name": "Stamps",
      "description": "Rubber stamps for packaging, paperwork and product marks.",
      "sort": 4
    },
    {
      "id": "10000000-0000-4000-8000-000000000005",
      "slug": "trophies",
      "name": "Trophies",
      "description": "Engraved plates, award bases and recognition products.",
      "sort": 5
    },
    {
      "id": "10000000-0000-4000-8000-000000000006",
      "slug": "laser-cut-work",
      "name": "Laser-cut work",
      "description": "Precision-cut panels, signage and custom fabricated shapes.",
      "sort": 6
    }
  ],
  "products": [
    {
      "id": "20000000-0000-4000-8000-000000000001",
      "division_id": "10000000-0000-4000-8000-000000000001",
      "slug": "custom-labels",
      "name": "Custom-cut labels",
      "description": "Any shape, any size, with print-safe artwork and a clean cut line.",
      "config": {
        "pricing": {
          "model": "area",
          "base_per_cm2": 0.012,
          "min_unit": 0.15
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            20,
            20
          ],
          "max_mm": [
            300,
            300
          ],
          "presets": [
            [
              50,
              50
            ],
            [
              100,
              50
            ],
            [
              100,
              100
            ]
          ]
        },
        "materials": [
          {
            "id": "vinyl",
            "name": "Gloss vinyl",
            "mult": 1
          },
          {
            "id": "paper",
            "name": "Matte paper",
            "mult": 0.8
          },
          {
            "id": "clear",
            "name": "Clear polyester",
            "mult": 1.35
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000002",
      "division_id": "10000000-0000-4000-8000-000000000001",
      "slug": "label-sheets",
      "name": "Printed label sheets",
      "description": "Organised A4 and A3 sheets for retail, dispatch and product marking.",
      "config": {
        "pricing": {
          "model": "area",
          "base_per_cm2": 0.008,
          "min_unit": 0.25
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            100,
            100
          ],
          "max_mm": [
            420,
            594
          ],
          "presets": [
            [
              210,
              297
            ],
            [
              297,
              420
            ]
          ]
        },
        "materials": [
          {
            "id": "paper",
            "name": "Uncoated paper",
            "mult": 1
          },
          {
            "id": "vinyl",
            "name": "Weatherproof vinyl",
            "mult": 1.45
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000003",
      "division_id": "10000000-0000-4000-8000-000000000002",
      "slug": "race-numbers",
      "name": "Race bib numbers",
      "description": "High-contrast bib numbers with optional CSV name and number merge.",
      "config": {
        "pricing": {
          "model": "flat",
          "flat_unit": 0.28,
          "min_unit": 0.15
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            80,
            60
          ],
          "max_mm": [
            200,
            150
          ],
          "presets": [
            [
              120,
              80
            ],
            [
              150,
              100
            ]
          ]
        },
        "materials": [
          {
            "id": "paper",
            "name": "Sturdy bib paper",
            "mult": 1
          },
          {
            "id": "vinyl",
            "name": "Waterproof vinyl",
            "mult": 1.3
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": true
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000004",
      "division_id": "10000000-0000-4000-8000-000000000002",
      "slug": "event-number-boards",
      "name": "Event number boards",
      "description": "Reusable course markers and oversized event numbering.",
      "config": {
        "pricing": {
          "model": "flat",
          "flat_unit": 0.85,
          "min_unit": 0.5
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            150,
            100
          ],
          "max_mm": [
            400,
            300
          ],
          "presets": [
            [
              200,
              150
            ],
            [
              300,
              200
            ]
          ]
        },
        "materials": [
          {
            "id": "board",
            "name": "Fluted polyboard",
            "mult": 1
          },
          {
            "id": "aluminium",
            "name": "Aluminium composite",
            "mult": 1.8
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000005",
      "division_id": "10000000-0000-4000-8000-000000000003",
      "slug": "mtb-boards",
      "name": "Custom MTB number boards",
      "description": "Lightweight, high-impact number boards with rider and event branding.",
      "config": {
        "pricing": {
          "model": "flat",
          "flat_unit": 1.2,
          "min_unit": 0.8
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            150,
            100
          ],
          "max_mm": [
            400,
            300
          ],
          "presets": [
            [
              200,
              150
            ],
            [
              300,
              200
            ]
          ]
        },
        "materials": [
          {
            "id": "poly",
            "name": "4 mm polyboard",
            "mult": 1
          },
          {
            "id": "composite",
            "name": "Aluminium composite",
            "mult": 1.65
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000006",
      "division_id": "10000000-0000-4000-8000-000000000004",
      "slug": "custom-stamps",
      "name": "Custom rubber stamps",
      "description": "Precise text and logo stamps with a durable timber or self-inking body.",
      "config": {
        "pricing": {
          "model": "flat",
          "flat_unit": 2.5,
          "min_unit": 1.5
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            40,
            20
          ],
          "max_mm": [
            120,
            80
          ],
          "presets": [
            [
              60,
              30
            ],
            [
              80,
              40
            ],
            [
              100,
              50
            ]
          ]
        },
        "materials": [
          {
            "id": "wood",
            "name": "Timber mount",
            "mult": 1
          },
          {
            "id": "self-inking",
            "name": "Self-inking body",
            "mult": 1.55
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000007",
      "division_id": "10000000-0000-4000-8000-000000000005",
      "slug": "trophy-plates",
      "name": "Engraved trophy plates",
      "description": "Personalised metal plates for awards, trophies and presentation pieces.",
      "config": {
        "pricing": {
          "model": "area",
          "base_per_cm2": 0.02,
          "min_unit": 0.45
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            30,
            15
          ],
          "max_mm": [
            200,
            100
          ],
          "presets": [
            [
              80,
              40
            ],
            [
              100,
              50
            ],
            [
              120,
              60
            ]
          ]
        },
        "materials": [
          {
            "id": "brass",
            "name": "Brass effect",
            "mult": 1
          },
          {
            "id": "silver",
            "name": "Silver effect",
            "mult": 1.1
          },
          {
            "id": "black",
            "name": "Black anodised",
            "mult": 1.25
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    },
    {
      "id": "20000000-0000-4000-8000-000000000008",
      "division_id": "10000000-0000-4000-8000-000000000006",
      "slug": "laser-cut-panels",
      "name": "Custom laser-cut panels",
      "description": "Print, engrave and cut custom panels in acrylic, wood and card.",
      "config": {
        "pricing": {
          "model": "area",
          "base_per_cm2": 0.018,
          "min_unit": 0.6
        },
        "sizes": {
          "mode": "custom",
          "min_mm": [
            50,
            50
          ],
          "max_mm": [
            600,
            600
          ],
          "presets": [
            [
              100,
              100
            ],
            [
              200,
              150
            ],
            [
              300,
              200
            ]
          ]
        },
        "materials": [
          {
            "id": "acrylic",
            "name": "3 mm acrylic",
            "mult": 1
          },
          {
            "id": "wood",
            "name": "3 mm birch ply",
            "mult": 0.85
          },
          {
            "id": "card",
            "name": "Card stock",
            "mult": 0.55
          }
        ],
        "orientations": [
          "landscape",
          "portrait"
        ],
        "tiers": [
          {
            "min": 1,
            "discount": 0
          },
          {
            "min": 100,
            "discount": 0.1
          },
          {
            "min": 500,
            "discount": 0.2
          },
          {
            "min": 1000,
            "discount": 0.3
          }
        ],
        "vat_rate": 0.2,
        "designer": {
          "enabled": true,
          "csv_merge": false
        }
      },
      "active": true
    }
  ],
  "templates": [
    {
      "id": "30000000-0000-4000-8000-000000000001",
      "product_id": "20000000-0000-4000-8000-000000000001",
      "name": "Custom label",
      "base_width_mm": 100,
      "base_height_mm": 100,
      "print_area": {
        "x": 3,
        "y": 3,
        "w": 94,
        "h": 94
      },
      "bleed_mm": 3,
      "dpi": 300,
      "placeholders": [
        {
          "id": "headline",
          "label": "Headline",
          "default": "YOUR BRAND",
          "min_font_mm": 4,
          "max_font_mm": 18
        },
        {
          "id": "detail",
          "label": "Detail",
          "default": "Made with care",
          "min_font_mm": 2,
          "max_font_mm": 8
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000002",
      "product_id": "20000000-0000-4000-8000-000000000002",
      "name": "A4 label sheet",
      "base_width_mm": 210,
      "base_height_mm": 297,
      "print_area": {
        "x": 10,
        "y": 10,
        "w": 190,
        "h": 277
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "title",
          "label": "Product title",
          "default": "PRODUCT NAME",
          "min_font_mm": 4,
          "max_font_mm": 14
        },
        {
          "id": "code",
          "label": "Product code",
          "default": "DH-001",
          "min_font_mm": 3,
          "max_font_mm": 9
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000003",
      "product_id": "20000000-0000-4000-8000-000000000003",
      "name": "Race bib",
      "base_width_mm": 120,
      "base_height_mm": 80,
      "print_area": {
        "x": 8,
        "y": 8,
        "w": 104,
        "h": 64
      },
      "bleed_mm": 3,
      "dpi": 300,
      "placeholders": [
        {
          "id": "number",
          "label": "Race number",
          "default": "027",
          "min_font_mm": 25,
          "max_font_mm": 55,
          "tracking_mm": 1
        },
        {
          "id": "name",
          "label": "Athlete name",
          "default": "ALEX MORGAN",
          "min_font_mm": 5,
          "max_font_mm": 12
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000004",
      "product_id": "20000000-0000-4000-8000-000000000004",
      "name": "Course marker",
      "base_width_mm": 200,
      "base_height_mm": 150,
      "print_area": {
        "x": 10,
        "y": 10,
        "w": 180,
        "h": 130
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "number",
          "label": "Marker number",
          "default": "04",
          "min_font_mm": 30,
          "max_font_mm": 80
        },
        {
          "id": "label",
          "label": "Marker label",
          "default": "CHECKPOINT",
          "min_font_mm": 6,
          "max_font_mm": 16
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000005",
      "product_id": "20000000-0000-4000-8000-000000000005",
      "name": "MTB race board",
      "base_width_mm": 200,
      "base_height_mm": 150,
      "print_area": {
        "x": 10,
        "y": 10,
        "w": 180,
        "h": 130
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "number",
          "label": "Rider number",
          "default": "17",
          "min_font_mm": 35,
          "max_font_mm": 85
        },
        {
          "id": "name",
          "label": "Rider name",
          "default": "RIDER NAME",
          "min_font_mm": 6,
          "max_font_mm": 15
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000006",
      "product_id": "20000000-0000-4000-8000-000000000006",
      "name": "Rubber stamp",
      "base_width_mm": 60,
      "base_height_mm": 30,
      "print_area": {
        "x": 5,
        "y": 5,
        "w": 50,
        "h": 20
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "line1",
          "label": "First line",
          "default": "APPROVED",
          "min_font_mm": 4,
          "max_font_mm": 12
        },
        {
          "id": "line2",
          "label": "Second line",
          "default": "DIGITAL HEROES",
          "min_font_mm": 2,
          "max_font_mm": 6
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000007",
      "product_id": "20000000-0000-4000-8000-000000000007",
      "name": "Engraved plate",
      "base_width_mm": 80,
      "base_height_mm": 40,
      "print_area": {
        "x": 5,
        "y": 5,
        "w": 70,
        "h": 30
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "title",
          "label": "Award title",
          "default": "PARTICIPATION",
          "min_font_mm": 4,
          "max_font_mm": 10
        },
        {
          "id": "recipient",
          "label": "Recipient",
          "default": "RECIPIENT NAME",
          "min_font_mm": 3,
          "max_font_mm": 7
        }
      ]
    },
    {
      "id": "30000000-0000-4000-8000-000000000008",
      "product_id": "20000000-0000-4000-8000-000000000008",
      "name": "Laser-cut panel",
      "base_width_mm": 200,
      "base_height_mm": 150,
      "print_area": {
        "x": 8,
        "y": 8,
        "w": 184,
        "h": 134
      },
      "bleed_mm": 2,
      "dpi": 300,
      "placeholders": [
        {
          "id": "headline",
          "label": "Headline",
          "default": "MAKE YOUR MARK",
          "min_font_mm": 6,
          "max_font_mm": 22
        },
        {
          "id": "detail",
          "label": "Detail",
          "default": "Precision cut",
          "min_font_mm": 3,
          "max_font_mm": 9
        }
      ]
    }
  ]
}$dh_seed$::jsonb);

insert into public.divisions (id, slug, name, description, sort)
select id, slug, name, description, sort
from dh_seed_document,
  jsonb_to_recordset(data->'divisions') as seed(
    id uuid, slug text, name text, description text, sort integer
  )
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  sort = excluded.sort;

insert into public.products (id, division_id, slug, name, description, config, active)
select id, division_id, slug, name, description, config, active
from dh_seed_document,
  jsonb_to_recordset(data->'products') as seed(
    id uuid, division_id uuid, slug text, name text, description text, config jsonb, active boolean
  )
on conflict (id) do update set
  division_id = excluded.division_id,
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  config = excluded.config,
  active = excluded.active;

insert into public.templates (id, product_id, name, base_width_mm, base_height_mm, print_area, bleed_mm, dpi, placeholders)
select id, product_id, name, base_width_mm, base_height_mm, print_area, bleed_mm, dpi, placeholders
from dh_seed_document,
  jsonb_to_recordset(data->'templates') as seed(
    id uuid, product_id uuid, name text, base_width_mm numeric, base_height_mm numeric, print_area jsonb,
    bleed_mm numeric, dpi integer, placeholders jsonb
  )
on conflict (id) do update set
  product_id = excluded.product_id,
  name = excluded.name,
  base_width_mm = excluded.base_width_mm,
  base_height_mm = excluded.base_height_mm,
  print_area = excluded.print_area,
  bleed_mm = excluded.bleed_mm,
  dpi = excluded.dpi,
  placeholders = excluded.placeholders;

drop table dh_seed_document;
commit;

