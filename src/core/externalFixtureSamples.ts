import type { DecisionMatrix, MethodId, StudyConfig } from '../types';

export interface ExternalFixtureSample {
  methodId: MethodId;
  variant: string;
  source: string;
  sourceUrl: string;
  doi?: string;
  config: Partial<Omit<StudyConfig, 'methodParams'>> & { methodParams?: Record<string, string | number | boolean | undefined> };
  input: DecisionMatrix;
  expected?: Record<string, unknown>;
  tolerance?: number;
}

export const externalFixtureSamples = [
  {
    "methodId": "ahp",
    "variant": "crisp-criteria-priority",
    "source": "Resonance-Aware Power Factor Correction in Transmission Networks Using Weighted Indices and Tuned Passive Filters for Harmonic Mitigation, Energies, 2026, DOI: 10.3390/en19092214, equations 32-36",
    "sourceUrl": "https://www.mdpi.com/1996-1073/19/9/2214",
    "doi": "10.3390/en19092214",
    "config": {
      "title": "AHP external validation: three-criterion pairwise priority",
      "weightingId": "ahp",
      "methodParams": {
        "ahpPairwiseMode": "Criteria only",
        "ahpConsistencyThreshold": 0.1,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      },
      "ahpCriteriaPairwise": [
        [
          1,
          3,
          5
        ],
        [
          0.3333333333,
          1,
          3
        ],
        [
          0.2,
          0.3333333333,
          1
        ]
      ]
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Alternative 1"
        },
        {
          "id": "A2",
          "name": "Alternative 2"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "THD",
          "direction": "cost",
          "weight": 0.3333333333
        },
        {
          "id": "C2",
          "name": "PF",
          "direction": "benefit",
          "weight": 0.3333333333
        },
        {
          "id": "C3",
          "name": "D",
          "direction": "cost",
          "weight": 0.3333333333
        }
      ],
      "values": [
        [
          1,
          1,
          1
        ],
        [
          2,
          2,
          2
        ]
      ]
    },
    "expected": {
      "tables": [
        {
          "id": "criteria-priority",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.6333
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.2605
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.1062
            }
          ]
        },
        {
          "id": "consistency",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 3.0387
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.0194
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.0334
            },
            {
              "row": 4,
              "column": 1,
              "value": "Accepted"
            }
          ]
        }
      ],
      "diagnostics": [
        {
          "label": "AHP consistency ratio",
          "status": "pass"
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "aras",
    "variant": "crisp-normalized-matrix-manual-ahp-weights",
    "source": "An integration of hybrid MCDA framework to the statistical analysis of computer-based health monitoring applications, Frontiers in Public Health, 2023, DOI: 10.3389/fpubh.2023.1341871, Tables 2-4",
    "sourceUrl": "https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2023.1341871/full",
    "doi": "10.3389/fpubh.2023.1341871",
    "config": {
      "title": "ARAS external validation: health monitoring application selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Ap1"
        },
        {
          "id": "A2",
          "name": "Ap2"
        },
        {
          "id": "A3",
          "name": "Ap3"
        },
        {
          "id": "A4",
          "name": "Ap4"
        },
        {
          "id": "A5",
          "name": "Ap5"
        },
        {
          "id": "A6",
          "name": "Ap6"
        },
        {
          "id": "A7",
          "name": "Ap7"
        },
        {
          "id": "A8",
          "name": "Ap8"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.12
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.03
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.08
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.14
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.1
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.17
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.35
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "benefit",
          "weight": 0.02
        }
      ],
      "values": [
        [
          0.09,
          0.12,
          0.18,
          0.07,
          0.12,
          0.16,
          0.04,
          0.13
        ],
        [
          0.15,
          0.06,
          0.04,
          0.09,
          0.15,
          0.1,
          0.17,
          0.15
        ],
        [
          0.04,
          0.08,
          0.12,
          0.16,
          0.12,
          0.06,
          0.15,
          0.07
        ],
        [
          0.11,
          0.14,
          0.06,
          0.05,
          0.1,
          0.16,
          0.1,
          0.04
        ],
        [
          0.06,
          0.04,
          0.1,
          0.14,
          0.05,
          0.08,
          0.13,
          0.17
        ],
        [
          0.19,
          0.16,
          0.08,
          0.07,
          0.15,
          0.14,
          0.04,
          0.09
        ],
        [
          0.04,
          0.12,
          0.14,
          0.12,
          0.1,
          0.12,
          0.06,
          0.04
        ],
        [
          0.13,
          0.1,
          0.08,
          0.14,
          0.07,
          0.04,
          0.13,
          0.15
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Ap2",
          "score": 0.769
        },
        {
          "alternative": "Ap3",
          "score": 0.691
        },
        {
          "alternative": "Ap8",
          "score": 0.637
        },
        {
          "alternative": "Ap5"
        },
        {
          "alternative": "Ap4"
        },
        {
          "alternative": "Ap6"
        },
        {
          "alternative": "Ap1"
        },
        {
          "alternative": "Ap7",
          "score": 0.509
        }
      ],
      "tables": [
        {
          "id": "aras-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.09
            },
            {
              "row": 1,
              "column": 7,
              "value": 0.17
            },
            {
              "row": 5,
              "column": 1,
              "value": 0.19
            },
            {
              "row": 7,
              "column": 8,
              "value": 0.15
            }
          ]
        },
        {
          "id": "aras-weighted",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.015
            },
            {
              "row": 1,
              "column": 7,
              "value": 0.061
            },
            {
              "row": 2,
              "column": 4,
              "value": 0.022
            },
            {
              "row": 7,
              "column": 7,
              "value": 0.047
            }
          ]
        },
        {
          "id": "aras-utility",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.092
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.769
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.691
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.509
            }
          ]
        }
      ]
    },
    "tolerance": 0.015
  },
  {
    "methodId": "arlon",
    "variant": "crisp-product-log-job-candidate-dergipark-2025",
    "source": "Development of Multi Criteria Decision Making Method with the Help of Laguerre Polynomials, Dokuz Eylul University Faculty of Business Journal, 2025, DOI: 10.24889/ifede.1645218, Tables 1, 13-15",
    "sourceUrl": "https://dergipark.org.tr/tr/pub/ifede/article/1645218",
    "doi": "10.24889/ifede.1645218",
    "config": {
      "title": "ARLON validation: job candidate ranking",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "arlonGamma": 0.5
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Alp"
        },
        {
          "id": "A2",
          "name": "Mehmet"
        },
        {
          "id": "A3",
          "name": "Gulsen"
        },
        {
          "id": "A4",
          "name": "Nihal"
        },
        {
          "id": "A5",
          "name": "Yasemin"
        }
      ],
      "criteria": [
        {
          "id": "K1",
          "name": "Communication",
          "direction": "benefit",
          "weight": 0.247
        },
        {
          "id": "K2",
          "name": "Work experience",
          "direction": "benefit",
          "weight": 0.182
        },
        {
          "id": "K3",
          "name": "Exam",
          "direction": "benefit",
          "weight": 0.474
        },
        {
          "id": "K4",
          "name": "Appearance",
          "direction": "benefit",
          "weight": 0.097
        }
      ],
      "values": [
        [
          5,
          9,
          5,
          8
        ],
        [
          8,
          7,
          6,
          6
        ],
        [
          6,
          5,
          6,
          7
        ],
        [
          7,
          8,
          5,
          7
        ],
        [
          3,
          2,
          1,
          4
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Mehmet",
          "score": 0.246
        },
        {
          "alternative": "Nihal",
          "score": 0.234
        },
        {
          "alternative": "Gulsen",
          "score": 0.232
        },
        {
          "alternative": "Alp",
          "score": 0.228
        },
        {
          "alternative": "Yasemin",
          "score": 0.061
        }
      ],
      "tables": [
        {
          "id": "arlon-first-log-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.189
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.263
            },
            {
              "row": 4,
              "column": 3,
              "value": 0
            }
          ]
        },
        {
          "id": "arlon-weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.047
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.125
            },
            {
              "row": 3,
              "column": 4,
              "value": 0.021
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "aroman",
    "variant": "crisp-pymcdm-beta-lambda-example",
    "source": "pymcdm AROMAN documentation example, crawled 2026, citing IEEE Access 2023 AROMAN paper, DOI: 10.1109/ACCESS.2023.3265818",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.AROMAN",
    "doi": "10.1109/ACCESS.2023.3265818",
    "config": {
      "title": "AROMAN validation: pymcdm beta/lambda example",
      "weightingId": "manual",
      "methodParams": {
        "aromanBeta": 0.5,
        "aromanLambda": 0.5,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "cost",
          "weight": 0.28
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.22
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.26
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.15
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.09
        }
      ],
      "values": [
        [
          40000,
          1.2,
          1.4,
          8,
          9
        ],
        [
          38500,
          1.15,
          1.2,
          6,
          6
        ],
        [
          39400,
          0.6,
          1.1,
          7,
          5
        ],
        [
          48000,
          1.3,
          1.6,
          10,
          12
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A4",
          "score": 0.8718
        },
        {
          "alternative": "A1",
          "score": 0.6727
        },
        {
          "alternative": "A2",
          "score": 0.5535
        },
        {
          "alternative": "A3",
          "score": 0.4721
        }
      ],
      "tables": [
        {
          "id": "aroman-linear-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1579
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 3,
              "column": 5,
              "value": 1
            }
          ]
        },
        {
          "id": "aroman-blended-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1595
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.0951
            },
            {
              "row": 3,
              "column": 5,
              "value": 0.4274
            }
          ]
        },
        {
          "id": "aroman-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.2128
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.0447
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.8718
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "balancedSpotis",
    "variant": "crisp-manual-bounds-esp-alpha-0.5-pymcdm-example",
    "source": "pymcdm BalancedSPOTIS implementation example, crawled 2026, citing Enhancing Personalized Decision-Making with the Balanced SPOTIS Algorithm, ICAART/SciTePress 2025, DOI: 10.5220/0013119800003890",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.BalancedSPOTIS",
    "doi": "10.5220/0013119800003890",
    "config": {
      "title": "B-SPOTIS validation: pymcdm manual-bounds ESP example",
      "weightingId": "manual",
      "methodParams": {
        "balancedSpotisBounds": "Manual bounds",
        "balancedSpotisAlpha": 0.5,
        "espSpotisPoint": "9,-4,2",
        "spotisLowerBounds": "-5,-6,-8",
        "spotisUpperBounds": "12,10,5",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.2
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.3
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.5
        }
      ],
      "values": [
        [
          10.5,
          -3.1,
          1.7
        ],
        [
          -4.7,
          0,
          3.4
        ],
        [
          8.1,
          0.3,
          1.3
        ],
        [
          3.2,
          7.3,
          -5.3
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 0.1225
        },
        {
          "alternative": "A3",
          "score": 0.2122
        },
        {
          "alternative": "A2",
          "score": 0.3303
        },
        {
          "alternative": "A4",
          "score": 0.655
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.1225
        },
        {
          "alternative": "A2",
          "score": 0.3303
        },
        {
          "alternative": "A3",
          "score": 0.2122
        },
        {
          "alternative": "A4",
          "score": 0.655
        }
      ],
      "tables": [
        {
          "id": "balanced-spotis-bounds",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": -5
            },
            {
              "row": 0,
              "column": 5,
              "value": 12
            },
            {
              "row": 1,
              "column": 6,
              "value": -6
            },
            {
              "row": 2,
              "column": 7,
              "value": 2
            }
          ]
        },
        {
          "id": "balanced-spotis-ideal-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0882
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.1813
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.7923
            }
          ]
        },
        {
          "id": "balanced-spotis-expected-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0882
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.0563
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.5615
            }
          ]
        },
        {
          "id": "balanced-spotis-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1989
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.0461
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.1225
            },
            {
              "row": 3,
              "column": 4,
              "value": 0.655
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "balancedSpotis",
    "variant": "crisp-used-car-isp-esp-alpha-0.5-icaart-2025",
    "source": "Enhancing Personalized Decision-Making with the Balanced SPOTIS Algorithm, ICAART 2025, DOI: 10.5220/0013119800003890, Tables 1-3",
    "sourceUrl": "https://www.scitepress.org/publishedPapers/2025/131198/pdf/index.html",
    "doi": "10.5220/0013119800003890",
    "config": {
      "title": "B-SPOTIS validation: ICAART 2025 used-car ISP/ESP example",
      "weightingId": "manual",
      "methodParams": {
        "balancedSpotisBounds": "Manual bounds",
        "balancedSpotisAlpha": 0.5,
        "espSpotisPoint": "110,45,2018",
        "spotisLowerBounds": "70,35,2013",
        "spotisUpperBounds": "360,70,2018",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Mileage",
          "direction": "cost",
          "weight": 0.33
        },
        {
          "id": "C2",
          "name": "Price",
          "direction": "cost",
          "weight": 0.56
        },
        {
          "id": "C3",
          "name": "Year",
          "direction": "benefit",
          "weight": 0.11
        }
      ],
      "values": [
        [
          94,
          69.9,
          2017
        ],
        [
          297,
          42,
          2013
        ],
        [
          205,
          68.9,
          2015
        ],
        [
          360,
          36.9,
          2014
        ],
        [
          86,
          59.9,
          2017
        ],
        [
          79.6,
          63.8,
          2017
        ],
        [
          113,
          56.9,
          2015
        ],
        [
          171,
          58,
          2016
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A7",
          "score": 0.3626
        },
        {
          "alternative": "A5",
          "score": 0.3632
        },
        {
          "alternative": "A8",
          "score": 0.4242
        },
        {
          "alternative": "A2",
          "score": 0.4256
        },
        {
          "alternative": "A6",
          "score": 0.4256
        },
        {
          "alternative": "A4",
          "score": 0.4752
        },
        {
          "alternative": "A1",
          "score": 0.5232
        },
        {
          "alternative": "A3",
          "score": 0.6593
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.5232
        },
        {
          "alternative": "A2",
          "score": 0.4256
        },
        {
          "alternative": "A3",
          "score": 0.6593
        },
        {
          "alternative": "A4",
          "score": 0.4752
        },
        {
          "alternative": "A5",
          "score": 0.3632
        },
        {
          "alternative": "A6",
          "score": 0.4256
        },
        {
          "alternative": "A7",
          "score": 0.3626
        },
        {
          "alternative": "A8",
          "score": 0.4242
        }
      ],
      "tables": [
        {
          "id": "balanced-spotis-bounds",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": 70
            },
            {
              "row": 0,
              "column": 5,
              "value": 360
            },
            {
              "row": 0,
              "column": 6,
              "value": 70
            },
            {
              "row": 0,
              "column": 7,
              "value": 110
            },
            {
              "row": 2,
              "column": 6,
              "value": 2018
            },
            {
              "row": 2,
              "column": 7,
              "value": 2018
            }
          ]
        },
        {
          "id": "balanced-spotis-ideal-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0828
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.9971
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.1483
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.6257
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.6
            }
          ]
        },
        {
          "id": "balanced-spotis-expected-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0552
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.7114
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.0103
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.34
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.6
            }
          ]
        },
        {
          "id": "balanced-spotis-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.6077
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.4386
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.5232
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.4653
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.2598
            },
            {
              "row": 6,
              "column": 4,
              "value": 0.3626
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "cocoso",
    "variant": "crisp-linear-normalization-manual-weights-lambda-0.5",
    "source": "Application of Wasted and Recycled Materials for Production of Stabilized Layers of Road Structures, Buildings, 2022, DOI: 10.3390/buildings12050552, Tables 12-13 and Appendix Tables A3-A4",
    "sourceUrl": "https://www.mdpi.com/2075-5309/12/5/552",
    "doi": "10.3390/buildings12050552",
    "config": {
      "title": "CoCoSo external validation: stabilized road mixture selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "cocosoLambda": 0.5,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "M1"
        },
        {
          "id": "A2",
          "name": "M2"
        },
        {
          "id": "A3",
          "name": "M3"
        },
        {
          "id": "A4",
          "name": "M4"
        },
        {
          "id": "A5",
          "name": "M5"
        },
        {
          "id": "A6",
          "name": "M6"
        },
        {
          "id": "A7",
          "name": "M7"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Mechanical properties",
          "direction": "cost",
          "weight": 0.403
        },
        {
          "id": "C2",
          "name": "CO2 emissions",
          "direction": "cost",
          "weight": 0.3
        },
        {
          "id": "C3",
          "name": "Additional material",
          "direction": "cost",
          "weight": 0.297
        }
      ],
      "values": [
        [
          3,
          4,
          5
        ],
        [
          1,
          6,
          6
        ],
        [
          1,
          7,
          7
        ],
        [
          6,
          5,
          3
        ],
        [
          5,
          3,
          1
        ],
        [
          3,
          2,
          2
        ],
        [
          7,
          1,
          4
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "M6",
          "score": 2.985
        },
        {
          "alternative": "M5",
          "score": 2.647
        },
        {
          "alternative": "M1",
          "score": 2.386
        },
        {
          "alternative": "M2",
          "score": 2.217
        },
        {
          "alternative": "M4",
          "score": 1.97
        },
        {
          "alternative": "M7",
          "score": 1.893
        },
        {
          "alternative": "M3",
          "score": 1.26
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.667
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.167
            },
            {
              "row": 4,
              "column": 3,
              "value": 1
            },
            {
              "row": 6,
              "column": 2,
              "value": 1
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.268
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.05
            },
            {
              "row": 5,
              "column": 3,
              "value": 0.248
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.3
            }
          ]
        },
        {
          "id": "cocoso-components",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 2.901
            },
            {
              "row": 0,
              "column": 5,
              "value": 3.8
            },
            {
              "row": 4,
              "column": 7,
              "value": 2.647
            },
            {
              "row": 5,
              "column": 6,
              "value": 1
            },
            {
              "row": 5,
              "column": 7,
              "value": 2.985
            }
          ]
        }
      ]
    },
    "tolerance": 0.012
  },
  {
    "methodId": "codas",
    "variant": "crisp-linear-normalization-manual-weights-tau-0.02",
    "source": "A New Combinative Distance-Based Assessment (CODAS) Method for Multi-Criteria Decision-Making, Economic Computation and Economic Cybernetics Studies and Research, 2016, robot selection example, Tables 1-5",
    "sourceUrl": "https://www.researchgate.net/publication/308697546_A_new_combinative_distance-based_assessment_CODAS_method_for_multi-criteria_decision-making",
    "doi": "10.24818/18423264/50.3.16.07",
    "config": {
      "title": "CODAS external validation: industrial robot selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "codasTau": 0.02,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "ASEA-IRB 60/2"
        },
        {
          "id": "A2",
          "name": "Cincinnati Milacrone T3-726"
        },
        {
          "id": "A3",
          "name": "Cybotech V15 Electric Robot"
        },
        {
          "id": "A4",
          "name": "Hitachi America Process Robot"
        },
        {
          "id": "A5",
          "name": "Unimation PUMA 500/600"
        },
        {
          "id": "A6",
          "name": "United States Robots Maker 110"
        },
        {
          "id": "A7",
          "name": "Yaskawa Electric Motoman L3C"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Load capacity",
          "direction": "benefit",
          "weight": 0.036
        },
        {
          "id": "C2",
          "name": "Maximum tip speed",
          "direction": "cost",
          "weight": 0.192
        },
        {
          "id": "C3",
          "name": "Memory capacity",
          "direction": "cost",
          "weight": 0.326
        },
        {
          "id": "C4",
          "name": "Manipulator reach",
          "direction": "benefit",
          "weight": 0.326
        },
        {
          "id": "C5",
          "name": "Repeatability",
          "direction": "benefit",
          "weight": 0.12
        }
      ],
      "values": [
        [
          60,
          0.4,
          2540,
          500,
          990
        ],
        [
          6.35,
          0.15,
          1016,
          3000,
          1041
        ],
        [
          6.8,
          0.1,
          1727.2,
          1500,
          1676
        ],
        [
          10,
          0.2,
          1000,
          2000,
          965
        ],
        [
          2.5,
          0.1,
          560,
          500,
          915
        ],
        [
          4.5,
          0.08,
          1016,
          350,
          508
        ],
        [
          3,
          0.1,
          1778,
          1000,
          920
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Cincinnati Milacrone T3-726",
          "score": 2.094
        },
        {
          "alternative": "Unimation PUMA 500/600",
          "score": 1.2479
        },
        {
          "alternative": "Hitachi America Process Robot",
          "score": 0.4537
        },
        {
          "alternative": "Cybotech V15 Electric Robot",
          "score": 0.1483
        },
        {
          "alternative": "United States Robots Maker 110",
          "score": -0.373
        },
        {
          "alternative": "Yaskawa Electric Motoman L3C",
          "score": -0.9056
        },
        {
          "alternative": "ASEA-IRB 60/2",
          "score": -2.6652
        }
      ],
      "tables": [
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.036
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.1024
            },
            {
              "row": 4,
              "column": 3,
              "value": 0.326
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.326
            }
          ]
        },
        {
          "id": "codas-distances",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0514
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.3164
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.5002
            },
            {
              "row": 4,
              "column": 2,
              "value": 0.4148
            }
          ]
        },
        {
          "id": "codas-relative-assessment",
          "cells": [
            {
              "row": 0,
              "column": 7,
              "value": -0.2514
            },
            {
              "row": 1,
              "column": 8,
              "value": 2.094
            },
            {
              "row": 4,
              "column": 8,
              "value": 1.2479
            },
            {
              "row": 6,
              "column": 8,
              "value": -0.9056
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "comet",
    "variant": "crisp-minmax-topsis-expert-pymcdm-example",
    "source": "pymcdm COMET documentation example using MethodExpert(TOPSIS) and min/max characteristic values, citing the COMET foundation paper DOI: 10.1002/mcda.1525",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.COMET",
    "doi": "10.1002/mcda.1525",
    "config": {
      "title": "COMET external validation: pymcdm TOPSIS expert example",
      "weightingId": "manual",
      "methodParams": {
        "cometCharacteristicValues": "min,max",
        "cometPreferenceModel": "TOPSIS expert",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        },
        {
          "id": "A11",
          "name": "A11"
        },
        {
          "id": "A12",
          "name": "A12"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "cost",
          "weight": 0.1111111111
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "benefit",
          "weight": 0.1111111111
        },
        {
          "id": "C9",
          "name": "C9",
          "direction": "cost",
          "weight": 0.1111111111
        }
      ],
      "values": [
        [
          64,
          128,
          2.9,
          4.3,
          3.2,
          280,
          495,
          24763,
          3990
        ],
        [
          28,
          56,
          3.1,
          3.8,
          3.8,
          255,
          417,
          12975,
          2999
        ],
        [
          8,
          16,
          3.5,
          5.3,
          4.8,
          125,
          636,
          5725,
          539
        ],
        [
          12,
          24,
          3.7,
          4.8,
          4.5,
          105,
          637,
          8468,
          549
        ],
        [
          10,
          20,
          3.7,
          5.3,
          4.9,
          125,
          539,
          6399,
          499
        ],
        [
          8,
          16,
          3.6,
          4.4,
          4,
          65,
          501,
          4834,
          329
        ],
        [
          6,
          12,
          3.7,
          4.6,
          4.2,
          65,
          604,
          4562,
          299
        ],
        [
          16,
          32,
          3.4,
          4.9,
          4.2,
          105,
          647,
          10428,
          799
        ],
        [
          8,
          16,
          3.6,
          5,
          4.5,
          125,
          609,
          5615,
          399
        ],
        [
          18,
          36,
          3,
          4.8,
          4.3,
          165,
          480,
          8848,
          979
        ],
        [
          24,
          48,
          3.8,
          4.5,
          4,
          280,
          509,
          13552,
          1399
        ],
        [
          28,
          56,
          2.5,
          3.8,
          2.8,
          205,
          376,
          8585,
          10000
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A4",
          "score": 0.6168
        },
        {
          "alternative": "A3",
          "score": 0.6115
        },
        {
          "alternative": "A8",
          "score": 0.61
        },
        {
          "alternative": "A5",
          "score": 0.606
        },
        {
          "alternative": "A9",
          "score": 0.5719
        },
        {
          "alternative": "A7",
          "score": 0.5516
        },
        {
          "alternative": "A1",
          "score": 0.5433
        },
        {
          "alternative": "A11",
          "score": 0.4979
        },
        {
          "alternative": "A6",
          "score": 0.4842
        },
        {
          "alternative": "A10",
          "score": 0.4711
        },
        {
          "alternative": "A2",
          "score": 0.3447
        },
        {
          "alternative": "A12",
          "score": 0.1452
        }
      ],
      "tables": [
        {
          "id": "comet-characteristic-values",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": 64
            },
            {
              "row": 5,
              "column": 4,
              "value": 280
            },
            {
              "row": 8,
              "column": 3,
              "value": 299
            }
          ]
        },
        {
          "id": "comet-preference-function",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.5433
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.6168
            },
            {
              "row": 11,
              "column": 1,
              "value": 0.1452
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "copras",
    "variant": "crisp-column-sum-normalization-manual-weights",
    "source": "Comparative Analysis of Five Widely-Used Multi-Criteria Decision-Making Methods to Evaluate Clean Energy Technologies: A Case Study, Sustainability, 2022, DOI: 10.3390/su14031403, Tables 14-16",
    "sourceUrl": "https://www.mdpi.com/2071-1050/14/3/1403",
    "doi": "10.3390/su14031403",
    "config": {
      "title": "COPRAS external validation: clean energy technology selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Solar PV"
        },
        {
          "id": "A2",
          "name": "Wind"
        },
        {
          "id": "A3",
          "name": "Nuclear"
        },
        {
          "id": "A4",
          "name": "Biomass"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "cost",
          "weight": 0.03634
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.03527
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.01383
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.03187
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.00429
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "cost",
          "weight": 0.07736
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "cost",
          "weight": 0.02712
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "cost",
          "weight": 0.07797
        },
        {
          "id": "C9",
          "name": "C9",
          "direction": "cost",
          "weight": 0.27276
        },
        {
          "id": "C10",
          "name": "C10",
          "direction": "cost",
          "weight": 0.23455
        },
        {
          "id": "C11",
          "name": "C11",
          "direction": "benefit",
          "weight": 0.10175
        },
        {
          "id": "C12",
          "name": "C12",
          "direction": "benefit",
          "weight": 0.08731
        }
      ],
      "values": [
        [
          0.1429,
          0.3,
          0.1417,
          0.1852,
          0.2618,
          0.3462,
          0.4065,
          0.2,
          0.0085,
          0.0025,
          0.6176,
          0.12
        ],
        [
          0.1429,
          0.2,
          0.3333,
          0.1481,
          0.1885,
          0.4601,
          0.1611,
          0.125,
          0.0845,
          0.0013,
          0.125,
          0.56
        ],
        [
          0.4286,
          0.1,
          0.275,
          0.4444,
          0.2984,
          0.1435,
          0.1552,
          0.1125,
          0.0614,
          0.6305,
          0.1029,
          0.08
        ],
        [
          0.2857,
          0.4,
          0.25,
          0.2222,
          0.2513,
          0.0503,
          0.2772,
          0.5625,
          0.8455,
          0.3657,
          0.1544,
          0.24
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Solar PV",
          "score": 0.4148
        },
        {
          "alternative": "Wind",
          "score": 0.3338
        },
        {
          "alternative": "Nuclear",
          "score": 0.1373
        },
        {
          "alternative": "Biomass",
          "score": 0.1141
        }
      ],
      "tables": [
        {
          "id": "copras-components",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0917
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.0626
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.4148
            },
            {
              "row": 0,
              "column": 4,
              "value": 100
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.0779
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.0791
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.3335
            },
            {
              "row": 1,
              "column": 4,
              "value": 80.4829
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.039
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.205
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.1376
            },
            {
              "row": 2,
              "column": 4,
              "value": 33.1114
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.0613
            },
            {
              "row": 3,
              "column": 2,
              "value": 0.3834
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.114
            },
            {
              "row": 3,
              "column": 4,
              "value": 27.5054
            }
          ]
        }
      ]
    },
    "tolerance": 0.006
  },
  {
    "methodId": "dear",
    "variant": "crisp-mrpi-machining-mrr-surface-roughness",
    "source": "Evaluating CNC Milling Performance for Machining AISI 316 Stainless Steel with Carbide Cutting Tool Insert, Materials, 2022, DOI: 10.3390/ma15228051, Table 6",
    "sourceUrl": "https://www.mdpi.com/1996-1944/15/22/8051",
    "doi": "10.3390/ma15228051",
    "config": {
      "title": "DEAR validation: CNC milling multi-response optimization",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "E1",
          "name": "E1"
        },
        {
          "id": "E2",
          "name": "E2"
        },
        {
          "id": "E3",
          "name": "E3"
        },
        {
          "id": "E4",
          "name": "E4"
        },
        {
          "id": "E5",
          "name": "E5"
        },
        {
          "id": "E6",
          "name": "E6"
        },
        {
          "id": "E7",
          "name": "E7"
        },
        {
          "id": "E8",
          "name": "E8"
        },
        {
          "id": "E9",
          "name": "E9"
        },
        {
          "id": "E10",
          "name": "E10"
        },
        {
          "id": "E11",
          "name": "E11"
        },
        {
          "id": "E12",
          "name": "E12"
        },
        {
          "id": "E13",
          "name": "E13"
        },
        {
          "id": "E14",
          "name": "E14"
        },
        {
          "id": "E15",
          "name": "E15"
        },
        {
          "id": "E16",
          "name": "E16"
        },
        {
          "id": "E17",
          "name": "E17"
        },
        {
          "id": "E18",
          "name": "E18"
        },
        {
          "id": "E19",
          "name": "E19"
        },
        {
          "id": "E20",
          "name": "E20"
        }
      ],
      "criteria": [
        {
          "id": "MRR",
          "name": "MRR",
          "direction": "benefit",
          "weight": 0.5
        },
        {
          "id": "SR",
          "name": "SR",
          "direction": "cost",
          "weight": 0.5
        }
      ],
      "values": [
        [
          6733.82,
          0.517
        ],
        [
          1790.86,
          0.394
        ],
        [
          14544.3,
          0.964
        ],
        [
          28990,
          1.365
        ],
        [
          19354.3,
          1.118
        ],
        [
          19617.83,
          1.235
        ],
        [
          13970.3,
          0.937
        ],
        [
          22261.9,
          0.778
        ],
        [
          22290.7,
          1.15
        ],
        [
          12374.87,
          1.104
        ],
        [
          11429.8,
          0.988
        ],
        [
          14444.1,
          0.953
        ],
        [
          15597.8,
          1.001
        ],
        [
          15335.5,
          0.648
        ],
        [
          14072.4,
          0.943
        ],
        [
          14023.08,
          0.934
        ],
        [
          9372.42,
          0.415
        ],
        [
          14358.8,
          0.952
        ],
        [
          5448.5,
          0.974
        ],
        [
          7032.9,
          0.889
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "E4"
        },
        {
          "alternative": "E9"
        },
        {
          "alternative": "E6"
        },
        {
          "alternative": "E5"
        },
        {
          "alternative": "E8"
        },
        {
          "alternative": "E13"
        },
        {
          "alternative": "E3"
        },
        {
          "alternative": "E12"
        },
        {
          "alternative": "E18"
        },
        {
          "alternative": "E10"
        },
        {
          "alternative": "E15"
        },
        {
          "alternative": "E16"
        },
        {
          "alternative": "E7"
        },
        {
          "alternative": "E11"
        },
        {
          "alternative": "E14"
        },
        {
          "alternative": "E20"
        },
        {
          "alternative": "E19"
        },
        {
          "alternative": "E17"
        },
        {
          "alternative": "E1"
        },
        {
          "alternative": "E2"
        }
      ],
      "tables": [
        {
          "id": "dear-response-weights",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.024
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.079
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.102
            },
            {
              "row": 16,
              "column": 2,
              "value": 0.099
            }
          ]
        }
      ]
    },
    "tolerance": 0.0011
  },
  {
    "methodId": "dematel",
    "variant": "crisp-average-expert-direct-matrix-mean-threshold",
    "source": "Navigating Interdependencies In Collaborative Innovation: A Data-Driven DEMATEL Framework, Sage Open, 2025, DOI: 10.1177/21582440251387390, Tables 2-7",
    "sourceUrl": "https://journals.sagepub.com/doi/10.1177/21582440251387390",
    "doi": "10.1177/21582440251387390",
    "config": {
      "title": "DEMATEL external validation: collaborative innovation factors",
      "weightingId": "equal",
      "methodParams": {
        "dematelExpertCount": 10,
        "dematelAggregation": "Arithmetic mean",
        "dematelThreshold": "Mean threshold",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "F1",
          "name": "Market Dynamic Environment"
        },
        {
          "id": "F2",
          "name": "Knowledge Creation and Acquisition"
        },
        {
          "id": "F3",
          "name": "Technological Learning"
        },
        {
          "id": "F4",
          "name": "Trust"
        },
        {
          "id": "F5",
          "name": "Innovation Culture"
        },
        {
          "id": "F6",
          "name": "Organizational Learning"
        },
        {
          "id": "F7",
          "name": "Innovation Capabilities"
        },
        {
          "id": "F8",
          "name": "Governance"
        }
      ],
      "criteria": [
        {
          "id": "F1",
          "name": "Market Dynamic Environment",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F2",
          "name": "Knowledge Creation and Acquisition",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F3",
          "name": "Technological Learning",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F4",
          "name": "Trust",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F5",
          "name": "Innovation Culture",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F6",
          "name": "Organizational Learning",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F7",
          "name": "Innovation Capabilities",
          "direction": "benefit",
          "weight": 0.125
        },
        {
          "id": "F8",
          "name": "Governance",
          "direction": "benefit",
          "weight": 0.125
        }
      ],
      "values": [
        [
          0,
          0.8,
          1.8,
          0.9,
          2.2,
          2.3,
          3.8,
          3.9
        ],
        [
          2.7,
          0,
          4,
          0,
          0,
          1.8,
          1.9,
          2
        ],
        [
          3.6,
          1.8,
          0,
          0,
          0,
          1,
          0,
          0.9
        ],
        [
          0,
          4,
          3.5,
          0,
          3.8,
          2.2,
          1.2,
          1.8
        ],
        [
          4,
          2.8,
          2.4,
          0.7,
          0,
          4,
          1.1,
          0
        ],
        [
          2.8,
          3.8,
          3.9,
          1,
          0.8,
          0,
          2.1,
          2.1
        ],
        [
          2.5,
          4,
          0,
          0,
          3,
          1.4,
          0,
          0
        ],
        [
          0,
          1.5,
          0,
          1.8,
          2.9,
          0,
          1.1,
          0
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Market Dynamic Environment",
          "score": 5.0477
        },
        {
          "alternative": "Knowledge Creation and Acquisition",
          "score": 4.5733
        },
        {
          "alternative": "Organizational Learning",
          "score": 4.4805
        },
        {
          "alternative": "Innovation Culture",
          "score": 4.2913
        },
        {
          "alternative": "Innovation Capabilities",
          "score": 3.7803
        },
        {
          "alternative": "Technological Learning",
          "score": 3.6835
        },
        {
          "alternative": "Trust",
          "score": 3.2566
        },
        {
          "alternative": "Governance",
          "score": 3.1081
        }
      ],
      "tables": [
        {
          "id": "normalized-direct",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.0428
            },
            {
              "row": 3,
              "column": 5,
              "value": 0.2032
            },
            {
              "row": 5,
              "column": 3,
              "value": 0.2086
            },
            {
              "row": 7,
              "column": 5,
              "value": 0.1551
            }
          ]
        },
        {
          "id": "total-relation",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.2715
            },
            {
              "row": 3,
              "column": 2,
              "value": 0.4837
            },
            {
              "row": 5,
              "column": 6,
              "value": 0.2032
            },
            {
              "row": 7,
              "column": 8,
              "value": 0.0906
            }
          ]
        },
        {
          "id": "thresholded-total-relation",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.3303
            },
            {
              "row": 1,
              "column": 5,
              "value": 0
            },
            {
              "row": 3,
              "column": 4,
              "value": 0
            },
            {
              "row": 7,
              "column": 1,
              "value": 0
            }
          ]
        },
        {
          "id": "cause-effect",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": 5.0477
            },
            {
              "row": 1,
              "column": 5,
              "value": -0.8993
            },
            {
              "row": 3,
              "column": 5,
              "value": 1.8282
            },
            {
              "row": 7,
              "column": 4,
              "value": 3.1081
            }
          ]
        }
      ],
      "diagnostics": [
        {
          "label": "Diagonal check",
          "status": "pass"
        },
        {
          "label": "Normalization",
          "status": "pass"
        },
        {
          "label": "Threshold method",
          "status": "pass"
        }
      ]
    },
    "tolerance": 0.002
  },
  {
    "methodId": "dnma",
    "variant": "crisp-lmaw-weights-company-performance-serbia-2023",
    "source": "Performance Analysis of Companies in Serbia Based on the LMAW-DNMA Method, Business Systems Research, 2023, DOI: 10.2478/bsrj-2023-0016, Tables 2-11",
    "sourceUrl": "https://hrcak.srce.hr/en/307841",
    "doi": "10.2478/bsrj-2023-0016",
    "config": {
      "title": "DNMA validation: company performance in Serbia",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "dnmaIntegration": "Utility and rank integration",
        "dnmaModelWeights": "0.6,0.1,0.3",
        "dnmaPhi": 0.5
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "JP EPS BELGRADE"
        },
        {
          "id": "A2",
          "name": "NIS AD NOVI SAD"
        },
        {
          "id": "A3",
          "name": "TELEKOM SRBIJA AD, BELGRADE"
        },
        {
          "id": "A4",
          "name": "JP SRBIJAGAS NOVI SAD"
        },
        {
          "id": "A5",
          "name": "DELHAIZE S"
        },
        {
          "id": "A6",
          "name": "NELT CO. DOO BELGRADE"
        },
        {
          "id": "A7",
          "name": "DELTA HOLDING DOO BELGRADE"
        },
        {
          "id": "A8",
          "name": "MERCATA VT DOO"
        },
        {
          "id": "A9",
          "name": "PHOENIX PHARMA DOO BELGRADE"
        },
        {
          "id": "A10",
          "name": "COCA-COLA HBC - SERBIA DOO ZEMUN"
        },
        {
          "id": "A11",
          "name": "MY KIOSK GROUP DOO"
        },
        {
          "id": "A12",
          "name": "TARKETT DOO BACA PALANKA"
        },
        {
          "id": "A13",
          "name": "MK GROUP DOO BELGRADE"
        },
        {
          "id": "A14",
          "name": "KNEZ PETROL COMPANY DOO BELGRADE"
        },
        {
          "id": "A15",
          "name": "HEMOFARM AD VRSAC"
        },
        {
          "id": "A16",
          "name": "MILSED DOO BELGRADE"
        },
        {
          "id": "A17",
          "name": "FCA SERBIA DOO KRAGUJEVAC"
        },
        {
          "id": "A18",
          "name": "EMS AD BELGRADE"
        },
        {
          "id": "A19",
          "name": "KOEFIK DOO BELGRADE"
        },
        {
          "id": "A20",
          "name": "YURA CORPORATION DOO RACA"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Operating revenue",
          "direction": "benefit",
          "weight": 0.1941
        },
        {
          "id": "C2",
          "name": "Net profit/loss",
          "direction": "benefit",
          "weight": 0.1993
        },
        {
          "id": "C3",
          "name": "Business assets",
          "direction": "benefit",
          "weight": 0.194
        },
        {
          "id": "C4",
          "name": "Capital",
          "direction": "benefit",
          "weight": 0.2026
        },
        {
          "id": "C5",
          "name": "Number of employees",
          "direction": "benefit",
          "weight": 0.209
        }
      ],
      "values": [
        [
          24.013,
          959.978,
          602.051,
          319.834,
          -15.492
        ],
        [
          11.544,
          411.025,
          262.836,
          310.238,
          20.957
        ],
        [
          12.333,
          490.964,
          185.581,
          144.701,
          6.709
        ],
        [
          2.471,
          287.578,
          129.753,
          122.489,
          5.802
        ],
        [
          11.637,
          83.293,
          42.881,
          118.912,
          2.989
        ],
        [
          3.121,
          37.637,
          18.721,
          87.126,
          248
        ],
        [
          3.311,
          149.188,
          83.718,
          76.424,
          2.497
        ],
        [
          1.078,
          12.763,
          1.093,
          75.391,
          958
        ],
        [
          2.749,
          39.024,
          10.837,
          74.941,
          1.772
        ],
        [
          1.623,
          56.832,
          43.084,
          64.769,
          6.783
        ],
        [
          3.589,
          12.247,
          2.622,
          64.365,
          596
        ],
        [
          3.215,
          38.174,
          19.813,
          58.565,
          2.493
        ],
        [
          2.151,
          94.429,
          46.83,
          57.675,
          17.461
        ],
        [
          1.183,
          11.849,
          3.417,
          52.652,
          3.447
        ],
        [
          3.922,
          68.38,
          47.524,
          49.284,
          5.091
        ],
        [
          2.758,
          27.749,
          3.547,
          45.553,
          1.084
        ],
        [
          2.072,
          49.521,
          31.195,
          41.512,
          -3.866
        ],
        [
          1.656,
          105.336,
          69.53,
          39.043,
          2.362
        ],
        [
          2.983,
          34.703,
          8.502,
          38.062,
          152
        ],
        [
          6.913,
          27.713,
          4.458,
          37.188,
          -1.092
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "JP EPS BELGRADE",
          "score": 0.8
        },
        {
          "alternative": "NIS AD NOVI SAD",
          "score": 0.6662
        },
        {
          "alternative": "TELEKOM SRBIJA AD, BELGRADE",
          "score": 0.5945
        },
        {
          "alternative": "MERCATA VT DOO",
          "score": 0.5427
        }
      ],
      "scores": [
        {
          "alternative": "JP SRBIJAGAS NOVI SAD",
          "score": 0.4723
        },
        {
          "alternative": "MY KIOSK GROUP DOO",
          "score": 0.4511
        },
        {
          "alternative": "KNEZ PETROL COMPANY DOO BELGRADE",
          "score": 0.0554
        }
      ],
      "tables": [
        {
          "id": "dnma-targets",
          "cells": [
            {
              "row": 0,
              "column": 5,
              "value": 0.1934
            },
            {
              "row": 3,
              "column": 3,
              "value": 319.834
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.2099
            }
          ]
        },
        {
          "id": "linear-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.966
            },
            {
              "row": 13,
              "column": 1,
              "value": 0.0045
            }
          ]
        },
        {
          "id": "dnma-subordinate-utilities",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.7901
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2099
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.8045
            },
            {
              "row": 1,
              "column": 7,
              "value": 0.6662
            },
            {
              "row": 13,
              "column": 7,
              "value": 0.0554
            }
          ]
        }
      ]
    },
    "tolerance": 0.002
  },
  {
    "methodId": "eamr",
    "variant": "crisp-dressing-process-internal-grinding-machines-2022",
    "source": "A Comparative Study on Multi-Criteria Decision-Making in Dressing Process for Internal Grinding, Machines 2022, DOI: 10.3390/machines10050303, Table 7",
    "sourceUrl": "https://www.mdpi.com/2075-1702/10/5/303",
    "doi": "10.3390/machines10050303",
    "config": {
      "title": "EAMR validation: Machines 2022 internal-grinding dressing process example",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        },
        {
          "id": "A11",
          "name": "A11"
        },
        {
          "id": "A12",
          "name": "A12"
        },
        {
          "id": "A13",
          "name": "A13"
        },
        {
          "id": "A14",
          "name": "A14"
        },
        {
          "id": "A15",
          "name": "A15"
        },
        {
          "id": "A16",
          "name": "A16"
        }
      ],
      "criteria": [
        {
          "id": "Ra",
          "name": "Ra",
          "direction": "cost",
          "weight": 0.5003
        },
        {
          "id": "MRR",
          "name": "MRR",
          "direction": "benefit",
          "weight": 0.4997
        }
      ],
      "values": [
        [
          1,
          0.6174
        ],
        [
          1.709402,
          0.6999
        ],
        [
          1.875117,
          0.7538
        ],
        [
          1.511259,
          0.7468
        ],
        [
          1.974334,
          0.8374
        ],
        [
          1.474709,
          0.8513
        ],
        [
          1.449275,
          0.7919
        ],
        [
          1.685772,
          0.8234
        ],
        [
          1.191753,
          1
        ],
        [
          1.12765,
          1
        ],
        [
          1.072386,
          1
        ],
        [
          1.031353,
          0.9478
        ],
        [
          1.148897,
          0.9704
        ],
        [
          1.168497,
          1
        ],
        [
          1.120699,
          0.9452
        ],
        [
          1.004924,
          1
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A5",
          "score": 1.6511
        },
        {
          "alternative": "A3",
          "score": 1.4117
        },
        {
          "alternative": "A8",
          "score": 1.3863
        },
        {
          "alternative": "A6",
          "score": 1.2539
        },
        {
          "alternative": "A2",
          "score": 1.1949
        },
        {
          "alternative": "A9",
          "score": 1.1904
        },
        {
          "alternative": "A14",
          "score": 1.1671
        },
        {
          "alternative": "A7",
          "score": 1.1463
        },
        {
          "alternative": "A4",
          "score": 1.1272
        },
        {
          "alternative": "A10",
          "score": 1.1263
        },
        {
          "alternative": "A13",
          "score": 1.1136
        },
        {
          "alternative": "A11",
          "score": 1.0712
        },
        {
          "alternative": "A15",
          "score": 1.0581
        },
        {
          "alternative": "A16",
          "score": 1.0037
        },
        {
          "alternative": "A12",
          "score": 0.9764
        },
        {
          "alternative": "A1",
          "score": 0.6167
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.6167
        },
        {
          "alternative": "A2",
          "score": 1.1949
        },
        {
          "alternative": "A3",
          "score": 1.4117
        },
        {
          "alternative": "A4",
          "score": 1.1272
        },
        {
          "alternative": "A5",
          "score": 1.6511
        },
        {
          "alternative": "A6",
          "score": 1.2539
        },
        {
          "alternative": "A7",
          "score": 1.1463
        },
        {
          "alternative": "A8",
          "score": 1.3863
        },
        {
          "alternative": "A9",
          "score": 1.1904
        },
        {
          "alternative": "A10",
          "score": 1.1263
        },
        {
          "alternative": "A11",
          "score": 1.0712
        },
        {
          "alternative": "A12",
          "score": 0.9764
        },
        {
          "alternative": "A13",
          "score": 1.1136
        },
        {
          "alternative": "A14",
          "score": 1.1671
        },
        {
          "alternative": "A15",
          "score": 1.0581
        },
        {
          "alternative": "A16",
          "score": 1.0037
        }
      ],
      "tables": [
        {
          "id": "eamr-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.6174
            },
            {
              "row": 4,
              "column": 1,
              "value": 0.5065
            },
            {
              "row": 8,
              "column": 2,
              "value": 1
            },
            {
              "row": 15,
              "column": 1,
              "value": 0.9951
            }
          ]
        },
        {
          "id": "eamr-weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.5003
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.3085
            },
            {
              "row": 4,
              "column": 2,
              "value": 0.4184
            },
            {
              "row": 8,
              "column": 2,
              "value": 0.4997
            }
          ]
        },
        {
          "id": "eamr-appraisal",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.3085
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.5003
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.6167
            },
            {
              "row": 4,
              "column": 3,
              "value": 1.6511
            },
            {
              "row": 15,
              "column": 3,
              "value": 1.0037
            }
          ]
        }
      ]
    },
    "tolerance": 0.0012,
    "notes": "The source table publishes normalized n_ij and weighted v_ij values. This fixture uses a normalization-equivalent positive input reconstructed from those published n_ij values so the executable engine reproduces the EAMR Table 7 appraisal scores and ranks."
  },
  {
    "methodId": "edas",
    "variant": "crisp-average-solution-manual-weights-set-1",
    "source": "Multi-Criteria Inventory Classification Using a New Method of Evaluation Based on Distance from Average Solution (EDAS), Informatica, 2015, DOI: 10.15388/Informatica.2015.57, Tables 5-7",
    "sourceUrl": "https://www.researchgate.net/publication/282365682_Multi-Criteria_Inventory_Classification_Using_a_New_Method_of_Evaluation_Based_on_Distance_from_Average_Solution_EDAS",
    "doi": "10.15388/Informatica.2015.57",
    "config": {
      "title": "EDAS external validation: original MCDM comparative analysis",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Average solution",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.25
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.214
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.179
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.143
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.107
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "cost",
          "weight": 0.071
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "cost",
          "weight": 0.036
        }
      ],
      "values": [
        [
          23,
          264,
          2.37,
          0.05,
          167,
          8900,
          8.71
        ],
        [
          20,
          220,
          2.2,
          0.04,
          171,
          9100,
          8.23
        ],
        [
          17,
          231,
          1.98,
          0.15,
          192,
          10800,
          9.91
        ],
        [
          12,
          210,
          1.73,
          0.2,
          195,
          12300,
          10.21
        ],
        [
          15,
          243,
          2,
          0.14,
          187,
          12600,
          9.34
        ],
        [
          14,
          222,
          1.89,
          0.13,
          180,
          13200,
          9.22
        ],
        [
          21,
          262,
          2.43,
          0.06,
          160,
          10300,
          8.93
        ],
        [
          20,
          256,
          2.6,
          0.07,
          163,
          11400,
          8.44
        ],
        [
          19,
          266,
          2.1,
          0.06,
          157,
          11200,
          9.04
        ],
        [
          8,
          218,
          1.94,
          0.11,
          190,
          13400,
          10.11
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1"
        },
        {
          "alternative": "A7"
        },
        {
          "alternative": "A8"
        },
        {
          "alternative": "A2"
        },
        {
          "alternative": "A9"
        },
        {
          "alternative": "A3"
        },
        {
          "alternative": "A5"
        },
        {
          "alternative": "A6"
        },
        {
          "alternative": "A10"
        },
        {
          "alternative": "A4"
        }
      ],
      "tables": [
        {
          "id": "edas-average-solution",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 16.9
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.101
            },
            {
              "row": 0,
              "column": 7,
              "value": 9.214
            }
          ]
        },
        {
          "id": "edas",
          "cells": [
            {
              "row": 0,
              "column": 5,
              "value": 1
            },
            {
              "row": 1,
              "column": 5,
              "value": 0.82048
            },
            {
              "row": 3,
              "column": 5,
              "value": 0
            },
            {
              "row": 6,
              "column": 5,
              "value": 0.89946
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "electre",
    "variant": "crisp-hand-computed-rmcda-package",
    "source": "surveyframe R package ELECTRE I hand-computed test case based on the RMCDA ELECTRE I worked example, with standard ELECTRE reference DOI 10.2307/2628673",
    "sourceUrl": "https://rdrr.io/cran/surveyframe/src/tests/testthat/test-decision-preference.R",
    "doi": "10.2307/2628673",
    "config": {
      "title": "ELECTRE I external validation: hand-computed concordance and discordance",
      "weightingId": "manual",
      "methodParams": {
        "electreConcordance": 0.7,
        "electreDiscordance": 0.3,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "a1",
          "name": "a1"
        },
        {
          "id": "a2",
          "name": "a2"
        },
        {
          "id": "a3",
          "name": "a3"
        }
      ],
      "criteria": [
        {
          "id": "c1",
          "name": "c1",
          "direction": "benefit",
          "weight": 0.2
        },
        {
          "id": "c2",
          "name": "c2",
          "direction": "benefit",
          "weight": 0.15
        },
        {
          "id": "c3",
          "name": "c3",
          "direction": "benefit",
          "weight": 0.4
        },
        {
          "id": "c4",
          "name": "c4",
          "direction": "benefit",
          "weight": 0.25
        }
      ],
      "values": [
        [
          25,
          20,
          15,
          30
        ],
        [
          10,
          30,
          20,
          30
        ],
        [
          30,
          10,
          30,
          10
        ]
      ]
    },
    "expected": {
      "tables": [
        {
          "id": "concordance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.45
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.8
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.6
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.6
            }
          ]
        },
        {
          "id": "discordance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.5
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.75
            },
            {
              "row": 2,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 1
            }
          ]
        },
        {
          "id": "outranking",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0
            },
            {
              "row": 1,
              "column": 1,
              "value": 0
            },
            {
              "row": 2,
              "column": 1,
              "value": 0
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "ervd",
    "variant": "crisp-manual-reference-pymcdm-example",
    "source": "pymcdm ERVD documentation example, crawled 2026, citing A multiple criteria decision making method based on relative value distances, Foundations of Computing and Decision Sciences, 2015, DOI: 10.1515/fcds-2015-0017",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.ERVD",
    "doi": "10.1515/fcds-2015-0017",
    "config": {
      "title": "ERVD validation: pymcdm documentation example",
      "weightingId": "manual",
      "methodParams": {
        "ervdReferenceMode": "Manual reference point",
        "ervdReferencePoint": "80,80,80,80,80,80,80",
        "ervdLambda": 2.25,
        "ervdAlpha": 0.88,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        },
        {
          "id": "A11",
          "name": "A11"
        },
        {
          "id": "A12",
          "name": "A12"
        },
        {
          "id": "A13",
          "name": "A13"
        },
        {
          "id": "A14",
          "name": "A14"
        },
        {
          "id": "A15",
          "name": "A15"
        },
        {
          "id": "A16",
          "name": "A16"
        },
        {
          "id": "A17",
          "name": "A17"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.066
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.196
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.066
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.13
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.13
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.216
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.196
        }
      ],
      "values": [
        [
          80,
          70,
          87,
          77,
          76,
          80,
          75
        ],
        [
          85,
          65,
          76,
          80,
          75,
          65,
          75
        ],
        [
          78,
          90,
          72,
          80,
          85,
          90,
          85
        ],
        [
          75,
          84,
          69,
          85,
          65,
          65,
          70
        ],
        [
          84,
          67,
          60,
          75,
          85,
          75,
          80
        ],
        [
          85,
          78,
          82,
          81,
          79,
          80,
          80
        ],
        [
          77,
          83,
          74,
          70,
          71,
          65,
          70
        ],
        [
          78,
          82,
          72,
          80,
          78,
          70,
          60
        ],
        [
          85,
          90,
          80,
          88,
          90,
          80,
          85
        ],
        [
          89,
          75,
          79,
          67,
          77,
          70,
          75
        ],
        [
          65,
          55,
          68,
          62,
          70,
          50,
          60
        ],
        [
          70,
          64,
          65,
          65,
          60,
          60,
          65
        ],
        [
          95,
          80,
          70,
          75,
          70,
          75,
          75
        ],
        [
          70,
          80,
          79,
          80,
          85,
          80,
          70
        ],
        [
          60,
          78,
          87,
          70,
          66,
          70,
          65
        ],
        [
          92,
          85,
          88,
          90,
          85,
          90,
          95
        ],
        [
          86,
          87,
          80,
          70,
          72,
          80,
          85
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A16"
        },
        {
          "alternative": "A9"
        },
        {
          "alternative": "A3"
        },
        {
          "alternative": "A6"
        },
        {
          "alternative": "A17"
        },
        {
          "alternative": "A14"
        },
        {
          "alternative": "A1"
        },
        {
          "alternative": "A13"
        },
        {
          "alternative": "A5"
        },
        {
          "alternative": "A10"
        },
        {
          "alternative": "A8"
        },
        {
          "alternative": "A4"
        },
        {
          "alternative": "A2"
        },
        {
          "alternative": "A7"
        },
        {
          "alternative": "A15"
        },
        {
          "alternative": "A12"
        },
        {
          "alternative": "A11"
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.66
        },
        {
          "alternative": "A2",
          "score": 0.503
        },
        {
          "alternative": "A3",
          "score": 0.885
        },
        {
          "alternative": "A4",
          "score": 0.521
        },
        {
          "alternative": "A5",
          "score": 0.61
        },
        {
          "alternative": "A6",
          "score": 0.796
        },
        {
          "alternative": "A7",
          "score": 0.498
        },
        {
          "alternative": "A8",
          "score": 0.549
        },
        {
          "alternative": "A9",
          "score": 0.908
        },
        {
          "alternative": "A10",
          "score": 0.565
        },
        {
          "alternative": "A11",
          "score": 0.07
        },
        {
          "alternative": "A12",
          "score": 0.199
        },
        {
          "alternative": "A13",
          "score": 0.632
        },
        {
          "alternative": "A14",
          "score": 0.716
        },
        {
          "alternative": "A15",
          "score": 0.438
        },
        {
          "alternative": "A16",
          "score": 0.972
        },
        {
          "alternative": "A17",
          "score": 0.767
        }
      ],
      "tables": [
        {
          "id": "ervd-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0591
            },
            {
              "row": 8,
              "column": 6,
              "value": 0.0643
            },
            {
              "row": 15,
              "column": 7,
              "value": 0.0748
            }
          ]
        },
        {
          "id": "ervd-relative-performance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": -0.0308
            },
            {
              "row": 8,
              "column": 5,
              "value": 0.0139
            },
            {
              "row": 15,
              "column": 7,
              "value": 0.0201
            }
          ]
        },
        {
          "id": "ervd-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0273
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.053
            },
            {
              "row": 15,
              "column": 3,
              "value": 0.9717
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "espSpotis",
    "variant": "crisp-used-car-expected-solution-point-spotis-icaart-2025",
    "source": "Enhancing Personalized Decision-Making with the Balanced SPOTIS Algorithm, ICAART 2025, DOI: 10.5220/0013119800003890, Tables 1-3",
    "sourceUrl": "https://www.scitepress.org/publishedPapers/2025/131198/pdf/index.html",
    "doi": "10.5220/0013119800003890",
    "config": {
      "title": "ESP-SPOTIS validation: ICAART 2025 used-car expected solution point example",
      "weightingId": "manual",
      "methodParams": {
        "espSpotisBounds": "Manual bounds",
        "espSpotisPoint": "110,45,2018",
        "spotisLowerBounds": "70,35,2013",
        "spotisUpperBounds": "360,70,2018",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Mileage",
          "direction": "cost",
          "weight": 0.33
        },
        {
          "id": "C2",
          "name": "Price",
          "direction": "cost",
          "weight": 0.56
        },
        {
          "id": "C3",
          "name": "Year",
          "direction": "benefit",
          "weight": 0.11
        }
      ],
      "values": [
        [
          94,
          69.9,
          2017
        ],
        [
          297,
          42,
          2013
        ],
        [
          205,
          68.9,
          2015
        ],
        [
          360,
          36.9,
          2014
        ],
        [
          86,
          59.9,
          2017
        ],
        [
          79.6,
          63.8,
          2017
        ],
        [
          113,
          56.9,
          2015
        ],
        [
          171,
          58,
          2016
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A7",
          "score": 0.2598
        },
        {
          "alternative": "A5",
          "score": 0.2877
        },
        {
          "alternative": "A8",
          "score": 0.3214
        },
        {
          "alternative": "A6",
          "score": 0.3574
        },
        {
          "alternative": "A2",
          "score": 0.3708
        },
        {
          "alternative": "A1",
          "score": 0.4386
        },
        {
          "alternative": "A4",
          "score": 0.5021
        },
        {
          "alternative": "A3",
          "score": 0.5565
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.4386
        },
        {
          "alternative": "A2",
          "score": 0.3708
        },
        {
          "alternative": "A3",
          "score": 0.5565
        },
        {
          "alternative": "A4",
          "score": 0.5021
        },
        {
          "alternative": "A5",
          "score": 0.2877
        },
        {
          "alternative": "A6",
          "score": 0.3574
        },
        {
          "alternative": "A7",
          "score": 0.2598
        },
        {
          "alternative": "A8",
          "score": 0.3214
        }
      ],
      "tables": [
        {
          "id": "esp-spotis-bounds",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 70
            },
            {
              "row": 0,
              "column": 4,
              "value": 360
            },
            {
              "row": 0,
              "column": 5,
              "value": 110
            },
            {
              "row": 1,
              "column": 5,
              "value": 45
            },
            {
              "row": 2,
              "column": 5,
              "value": 2018
            }
          ]
        },
        {
          "id": "esp-spotis-normalized-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0552
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.7114
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.0103
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.34
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.6
            }
          ]
        },
        {
          "id": "esp-spotis-weighted-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0182
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.3984
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.022
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.0034
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.1904
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.066
            }
          ]
        },
        {
          "id": "esp-spotis-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.4386
            },
            {
              "row": 4,
              "column": 1,
              "value": 0.2877
            },
            {
              "row": 6,
              "column": 1,
              "value": 0.2598
            },
            {
              "row": 7,
              "column": 1,
              "value": 0.3214
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "evamix",
    "variant": "crisp-mixed-data-composite-reinforcement-ajor-2013",
    "source": "American Journal of Operations Research 2013 AHP/EVAMIX composite-reinforcement selection example, DOI: 10.4236/ajor.2013.36053, Tables 7-12",
    "sourceUrl": "https://file.scirp.org/Html/11-1040275_39747.htm",
    "doi": "10.4236/ajor.2013.36053",
    "config": {
      "title": "EVAMIX validation: composite reinforcement selection",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "evamixDataMode": "Ordinal + cardinal criteria",
        "evamixOrdinalCriteria": "C4"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Chopped glass fiber"
        },
        {
          "id": "A2",
          "name": "Chopped carbon fiber"
        },
        {
          "id": "A3",
          "name": "Chopped aramid fiber"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Tensile strength",
          "direction": "benefit",
          "weight": 0.2662
        },
        {
          "id": "C2",
          "name": "Tensile modulus",
          "direction": "benefit",
          "weight": 0.2517
        },
        {
          "id": "C3",
          "name": "Volume fraction",
          "direction": "benefit",
          "weight": 0.2842
        },
        {
          "id": "C4",
          "name": "Elongation",
          "direction": "benefit",
          "weight": 0.1979
        }
      ],
      "values": [
        [
          1600,
          35,
          50,
          4
        ],
        [
          3528,
          98,
          40,
          1.5
        ],
        [
          2900,
          18,
          30,
          4.4
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Chopped carbon fiber",
          "score": 0.8492
        },
        {
          "alternative": "Chopped glass fiber",
          "score": 0.5154
        },
        {
          "alternative": "Chopped aramid fiber",
          "score": 0.192
        }
      ],
      "tables": [
        {
          "id": "evamix-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.2125
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.5
            },
            {
              "row": 2,
              "column": 4,
              "value": 1
            }
          ]
        },
        {
          "id": "evamix-cardinal-dominance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": -0.2337
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.8021
            }
          ]
        },
        {
          "id": "evamix-standardized-dominance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.4821
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.8021
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.4641
            }
          ]
        },
        {
          "id": "evamix-appraisal",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.5154
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.8492
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.192
            }
          ]
        }
      ]
    },
    "tolerance": 0.00015
  },
  {
    "methodId": "fuca",
    "variant": "crisp-average-rank-manual-weights-mcdabench-example",
    "source": "mcdabench 2026 FUCA reference manual example, Cagatay Cebeci, CRAN package DOI: 10.32614/CRAN.package.mcdabench; method reference cites Fernando et al. 2011 IEEE Symposium on Computational Intelligence in Multicriteria Decision-Making",
    "sourceUrl": "https://cran.r-universe.dev/mcdabench/doc/manual.html",
    "doi": "10.32614/CRAN.package.mcdabench",
    "config": {
      "title": "FUCA external validation: mcdabench manual weighted-rank example",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "fucaRankMode": "Weighted criterion-wise ranks"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.1
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.4
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.3
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.2
        }
      ],
      "values": [
        [
          84,
          10,
          5,
          20
        ],
        [
          66,
          18,
          8,
          15
        ],
        [
          74,
          12,
          6,
          25
        ],
        [
          90,
          22,
          9,
          18
        ],
        [
          68,
          18,
          7,
          15
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A2",
          "score": 2.8
        },
        {
          "alternative": "A1",
          "score": 2.9
        },
        {
          "alternative": "A4",
          "score": 3
        },
        {
          "alternative": "A5",
          "score": 3
        },
        {
          "alternative": "A3",
          "score": 3.3
        }
      ],
      "tables": [
        {
          "id": "fuca-rank-matrix",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 2
            },
            {
              "row": 1,
              "column": 2,
              "value": 3.5
            },
            {
              "row": 4,
              "column": 4,
              "value": 1.5
            }
          ]
        },
        {
          "id": "fuca-weighted-rank-matrix",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 1.5
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.3
            },
            {
              "row": 3,
              "column": 2,
              "value": 2
            }
          ]
        },
        {
          "id": "fuca-final-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 2.9
            },
            {
              "row": 1,
              "column": 1,
              "value": 2.8
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "gra",
    "variant": "crisp-minmax-ahp-weights-hospital-supplier",
    "source": "Integrated Multicriteria Decision-Making Methods to Solve Supplier Selection Problem: A Case Study in a Hospital, Journal of Healthcare Engineering, 2019, DOI: 10.1155/2019/5614892, Tables 3, 5, and 7",
    "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6811789/",
    "doi": "10.1155/2019/5614892",
    "config": {
      "title": "GRA external validation: hospital supplier selection",
      "weightingId": "manual",
      "methodParams": {
        "graZeta": 0.5,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "S1",
          "name": "Supplier1"
        },
        {
          "id": "S2",
          "name": "Supplier2"
        },
        {
          "id": "S3",
          "name": "Supplier3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Logistics",
          "direction": "benefit",
          "weight": 0.513
        },
        {
          "id": "C2",
          "name": "Quality",
          "direction": "benefit",
          "weight": 0.129
        },
        {
          "id": "C3",
          "name": "Cost",
          "direction": "cost",
          "weight": 0.262
        },
        {
          "id": "C4",
          "name": "Flexibility",
          "direction": "benefit",
          "weight": 0.063
        },
        {
          "id": "C5",
          "name": "Reliability",
          "direction": "benefit",
          "weight": 0.033
        }
      ],
      "values": [
        [
          0.731,
          0.292,
          0.193,
          0.64,
          0.086
        ],
        [
          0.188,
          0.079,
          0.203,
          0.183,
          0.314
        ],
        [
          0.081,
          0.629,
          0.605,
          0.177,
          0.6
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Supplier1",
          "score": 0.907
        },
        {
          "alternative": "Supplier2",
          "score": 0.521
        },
        {
          "alternative": "Supplier3",
          "score": 0.442
        }
      ],
      "tables": [
        {
          "id": "weighted-grey-coefficients",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.513
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.058
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.262
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.063
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.011
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.192
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.043
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.249
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.021
            },
            {
              "row": 1,
              "column": 5,
              "value": 0.016
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.171
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.129
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.087
            },
            {
              "row": 2,
              "column": 4,
              "value": 0.021
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.033
            }
          ]
        },
        {
          "id": "gra-grades",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.907
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.521
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.442
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "grp",
    "variant": "crisp-comparable-linguistic-hr-manager-ajbm-2012",
    "source": "African Journal of Business Management 2012 human-resources manager grey relation projection example, DOI: 10.5897/AJBM10.1622, Tables 2-4 and projection values",
    "sourceUrl": "https://www.yumpu.com/en/document/view/6854194/business-management-academic-journals/508",
    "doi": "10.5897/AJBM10.1622",
    "config": {
      "title": "GRP validation: human-resources manager competency evaluation",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "graZeta": 0.5,
        "grpInputScale": "Use comparable values directly"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Candidate a1"
        },
        {
          "id": "A2",
          "name": "Candidate a2"
        },
        {
          "id": "A3",
          "name": "Candidate a3"
        },
        {
          "id": "A4",
          "name": "Candidate a4"
        }
      ],
      "criteria": [
        {
          "id": "B1",
          "name": "B1",
          "direction": "benefit",
          "weight": 0.043
        },
        {
          "id": "B2",
          "name": "B2",
          "direction": "benefit",
          "weight": 0.033
        },
        {
          "id": "B3",
          "name": "B3",
          "direction": "benefit",
          "weight": 0.067
        },
        {
          "id": "B4",
          "name": "B4",
          "direction": "benefit",
          "weight": 0.062
        },
        {
          "id": "B5",
          "name": "B5",
          "direction": "benefit",
          "weight": 0.067
        },
        {
          "id": "B6",
          "name": "B6",
          "direction": "benefit",
          "weight": 0.048
        },
        {
          "id": "B7",
          "name": "B7",
          "direction": "benefit",
          "weight": 0.057
        },
        {
          "id": "B8",
          "name": "B8",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "B9",
          "name": "B9",
          "direction": "benefit",
          "weight": 0.081
        },
        {
          "id": "B10",
          "name": "B10",
          "direction": "benefit",
          "weight": 0.072
        },
        {
          "id": "B11",
          "name": "B11",
          "direction": "benefit",
          "weight": 0.043
        },
        {
          "id": "B12",
          "name": "B12",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "B13",
          "name": "B13",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "B14",
          "name": "B14",
          "direction": "benefit",
          "weight": 0.081
        },
        {
          "id": "B15",
          "name": "B15",
          "direction": "benefit",
          "weight": 0.081
        },
        {
          "id": "B16",
          "name": "B16",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "B17",
          "name": "B17",
          "direction": "benefit",
          "weight": 0.053
        }
      ],
      "values": [
        [
          3.667,
          3.667,
          4.667,
          4.667,
          4,
          3.667,
          3.667,
          5.667,
          4,
          3.333,
          4,
          5,
          4.667,
          4.333,
          4,
          4.667,
          3
        ],
        [
          4.333,
          4,
          3.333,
          2.667,
          4.667,
          5.333,
          4,
          3.667,
          5.333,
          4.667,
          3,
          4.333,
          5,
          3.667,
          4,
          3.333,
          3.333
        ],
        [
          3.333,
          4.667,
          3.333,
          3.333,
          4,
          2.667,
          4.667,
          4,
          3.333,
          3.333,
          5.333,
          3.333,
          2.333,
          4.333,
          4.333,
          4.333,
          4
        ],
        [
          3.333,
          4.667,
          4.667,
          3.333,
          4,
          4,
          2.333,
          2.333,
          3.667,
          4,
          4.667,
          5,
          3.667,
          2,
          5.667,
          4.667,
          2.333
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Candidate a1",
          "score": 0.526
        },
        {
          "alternative": "Candidate a2",
          "score": 0.52
        },
        {
          "alternative": "Candidate a4",
          "score": 0.471
        },
        {
          "alternative": "Candidate a3",
          "score": 0.458
        }
      ],
      "tables": [
        {
          "id": "grp-positive-coefficients",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.714
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 11,
              "value": 1
            },
            {
              "row": 3,
              "column": 8,
              "value": 0.333
            }
          ]
        },
        {
          "id": "grp-projection",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.187
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.169
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.185
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.196
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.471
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "lexicographic",
    "variant": "crisp-two-alternative-priority-example-jmcda-2022",
    "source": "How do people aggregate value? An experiment with relative importance of criteria and relative goodness of alternatives as inputs, Journal of Multi-Criteria Decision Analysis, 2022",
    "sourceUrl": "https://doi.org/10.1002/mcda.1773",
    "doi": "10.1002/mcda.1773",
    "config": {
      "title": "Lexicographic validation: two-alternative priority example",
      "weightingId": "equal",
      "alternatives": [
        {
          "id": "A",
          "name": "Car A"
        },
        {
          "id": "B",
          "name": "Car B"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Price",
          "direction": "benefit",
          "weight": 0.5
        },
        {
          "id": "C2",
          "name": "Comfort",
          "direction": "benefit",
          "weight": 0.5
        }
      ],
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "lexicographicOrder": "C1,C2"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A",
          "name": "Car A"
        },
        {
          "id": "B",
          "name": "Car B"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Price",
          "direction": "benefit",
          "weight": 0.5
        },
        {
          "id": "C2",
          "name": "Comfort",
          "direction": "benefit",
          "weight": 0.5
        }
      ],
      "values": [
        [
          2,
          1
        ],
        [
          1,
          5
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Car A",
          "score": 2
        },
        {
          "alternative": "Car B",
          "score": 1
        }
      ],
      "scores": [
        {
          "alternative": "Car A",
          "score": 2
        },
        {
          "alternative": "Car B",
          "score": 1
        }
      ],
      "tables": [
        {
          "id": "lexicographic-order",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": "C1"
            },
            {
              "row": 1,
              "column": 1,
              "value": "C2"
            }
          ]
        },
        {
          "id": "lexicographic-transformed",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 2
            },
            {
              "row": 1,
              "column": 2,
              "value": 5
            }
          ]
        },
        {
          "id": "lexicographic-comparisons",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": "C1"
            },
            {
              "row": 0,
              "column": 3,
              "value": "Car A outranks Car B on Price"
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "lmaw",
    "variant": "crisp-nonlinear-q-utility-jmcdm",
    "source": "JMcDM LMAW worked example, generated documentation dated 2025-04-29, citing Pamucar et al. 2021 original LMAW paper",
    "sourceUrl": "https://jbytecode.github.io/JMcDM/stable/mcdms/#LMAW",
    "doi": "10.22190/FUME210214031P",
    "config": {
      "title": "LMAW validation: JMcDM logistics worked example",
      "weightingId": "manual",
      "methodParams": {
        "lmawScaling": "Log additive scaling",
        "lmawScoreMode": "Nonlinear Q utility",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.215
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.126
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.152
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.091
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.19
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.226
        }
      ],
      "values": [
        [
          647.34,
          6.24,
          49.87,
          19.46,
          212.58,
          6.75
        ],
        [
          115.64,
          3.24,
          16.26,
          9.69,
          207.59,
          3
        ],
        [
          373.61,
          5,
          26.43,
          12,
          184.62,
          3.74
        ],
        [
          37.63,
          2.48,
          2.85,
          9.25,
          142.5,
          3.24
        ],
        [
          858.01,
          4.74,
          62.85,
          45.96,
          267.95,
          4
        ],
        [
          222.92,
          3,
          19.24,
          21.46,
          221.38,
          3.49
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 4.839
        },
        {
          "alternative": "A3",
          "score": 4.7977
        },
        {
          "alternative": "A5",
          "score": 4.7342
        },
        {
          "alternative": "A4",
          "score": 4.7321
        },
        {
          "alternative": "A6",
          "score": 4.7022
        },
        {
          "alternative": "A2",
          "score": 4.6797
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 4.839
        },
        {
          "alternative": "A2",
          "score": 4.6797
        },
        {
          "alternative": "A3",
          "score": 4.7977
        },
        {
          "alternative": "A4",
          "score": 4.7321
        },
        {
          "alternative": "A5",
          "score": 4.7342
        },
        {
          "alternative": "A6",
          "score": 4.7022
        }
      ],
      "tables": [
        {
          "id": "standardized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1.7545
            },
            {
              "row": 0,
              "column": 3,
              "value": 1.0571
            },
            {
              "row": 3,
              "column": 5,
              "value": 2
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.8067
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.8726
            },
            {
              "row": 0,
              "column": 6,
              "value": 0.7834
            }
          ]
        },
        {
          "id": "lmaw-index",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 4.839
            },
            {
              "row": 1,
              "column": 1,
              "value": 4.6797
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "lopm",
    "variant": "crisp-manual-property-limits-pymcdm-material-selection",
    "source": "pymcdm LoPM documentation example, crawled 2026, citing Farag 2020 Materials and process selection for engineering design, DOI: 10.1201/9781003006091",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.LoPM",
    "doi": "10.1201/9781003006091",
    "config": {
      "title": "LoPM validation: pymcdm material-selection example",
      "weightingId": "manual",
      "methodParams": {
        "lopmLimitsMode": "Manual property limits",
        "lopmTargetTolerance": 0,
        "lopmPropertyTypes": "lower,lower,upper,upper,target,upper",
        "lopmPropertyLimits": "10000,14,0.0015,3.5,2.3,9.0",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.2
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.33
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.13
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.07
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.07
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "cost",
          "weight": 0.2
        }
      ],
      "values": [
        [
          14820,
          18,
          0.0002,
          2.1,
          9.5,
          4.5
        ],
        [
          21450,
          18,
          0.0012,
          2.7,
          14.4,
          9
        ],
        [
          78000,
          16,
          0.0006,
          2.6,
          9,
          8.5
        ],
        [
          20475,
          17,
          0.0006,
          2.6,
          6.5,
          2.6
        ],
        [
          16575,
          14,
          0.001,
          3.1,
          5.6,
          3.5
        ],
        [
          21450,
          16,
          0.0005,
          2.2,
          8.6,
          1
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A4",
          "score": 0.659
        },
        {
          "alternative": "A6",
          "score": 0.6833
        },
        {
          "alternative": "A1",
          "score": 0.7701
        },
        {
          "alternative": "A5",
          "score": 0.7775
        },
        {
          "alternative": "A3",
          "score": 0.8112
        },
        {
          "alternative": "A2",
          "score": 1.0762
        }
      ],
      "tables": [
        {
          "id": "lopm-property-limits",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": "lower"
            },
            {
              "row": 2,
              "column": 3,
              "value": "upper"
            },
            {
              "row": 4,
              "column": 3,
              "value": "target"
            },
            {
              "row": 5,
              "column": 4,
              "value": 9
            }
          ]
        },
        {
          "id": "lopm-merit-components",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.6748
            },
            {
              "row": 0,
              "column": 5,
              "value": 3.1304
            },
            {
              "row": 3,
              "column": 6,
              "value": 0.2889
            }
          ]
        },
        {
          "id": "lopm-weighted-merit",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.135
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.2191
            },
            {
              "row": 3,
              "column": 6,
              "value": 0.0578
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "mabac",
    "variant": "crisp-linear-normalization-manual-weights",
    "source": "Optimizing Cross-Dock Terminal Location Selection: A Multi-Step Approach Based on CI-DEA-IDOCRIW-MABAC for Enhanced Supply Chain Efficiency-A Case Study, Mathematics, 2024, DOI: 10.3390/math12050736, Tables 4-9",
    "sourceUrl": "https://www.mdpi.com/2227-7390/12/5/736",
    "doi": "10.3390/math12050736",
    "config": {
      "title": "MABAC external validation: cross-dock terminal location selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "City center"
        },
        {
          "id": "A2",
          "name": "West"
        },
        {
          "id": "A3",
          "name": "Southeast"
        },
        {
          "id": "A4",
          "name": "Southwest"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "cost",
          "weight": 0.034038
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.126583
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.064303
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.040095
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.205939
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.300525
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.076349
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "benefit",
          "weight": 0.135841
        },
        {
          "id": "C9",
          "name": "C9",
          "direction": "cost",
          "weight": 0.016326
        }
      ],
      "values": [
        [
          3,
          4,
          2,
          6,
          3,
          2,
          4,
          2,
          4
        ],
        [
          3,
          2,
          3,
          3,
          4,
          3,
          5,
          3,
          5
        ],
        [
          5,
          5,
          4,
          4,
          7,
          7,
          7,
          4,
          4
        ],
        [
          4,
          3,
          5,
          6,
          10,
          9,
          6,
          5,
          3
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Southwest",
          "score": 0.3459
        },
        {
          "alternative": "Southeast",
          "score": 0.2594
        },
        {
          "alternative": "West",
          "score": -0.1627
        },
        {
          "alternative": "City center",
          "score": -0.2319
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.6667
            },
            {
              "row": 1,
              "column": 4,
              "value": 1
            },
            {
              "row": 3,
              "column": 9,
              "value": 1
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.068076
            },
            {
              "row": 0,
              "column": 6,
              "value": 0.300525
            },
            {
              "row": 3,
              "column": 6,
              "value": 0.60105
            },
            {
              "row": 3,
              "column": 9,
              "value": 0.032652
            }
          ]
        },
        {
          "id": "border-area",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.053272
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.183793
            },
            {
              "row": 0,
              "column": 6,
              "value": 0.422821
            },
            {
              "row": 0,
              "column": 9,
              "value": 0.023778
            }
          ]
        },
        {
          "id": "distance-border",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0148
            },
            {
              "row": 0,
              "column": 6,
              "value": -0.1223
            },
            {
              "row": 3,
              "column": 6,
              "value": 0.1782
            },
            {
              "row": 3,
              "column": 9,
              "value": 0.0089
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "macbeth",
    "variant": "crisp-continuous-value-rmcda-simple-example",
    "source": "RMCDA apply.MACBETH documentation/source example for weighted continuous value scoring, RMCDA Software Impacts package paper, 2025",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/man/apply.MACBETH.html",
    "doi": "10.1016/j.simpa.2025.100762",
    "config": {
      "title": "MACBETH validation: RMCDA continuous value example",
      "weightingId": "manual",
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.6
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "cost",
          "weight": 0.4
        }
      ],
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "macbethScoringMode": "Continuous value scoring",
        "macbethCategoryScale": "0,1,2,3,4,5,6"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.6
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "cost",
          "weight": 0.4
        }
      ],
      "values": [
        [
          10,
          5
        ],
        [
          12,
          4
        ],
        [
          11,
          6
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A2",
          "score": 1
        },
        {
          "alternative": "A3",
          "score": 0.3
        },
        {
          "alternative": "A1",
          "score": 0.2
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.2
        },
        {
          "alternative": "A2",
          "score": 1
        },
        {
          "alternative": "A3",
          "score": 0.3
        }
      ],
      "tables": [
        {
          "id": "macbeth-continuous-value-matrix",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.5
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 0
            }
          ]
        },
        {
          "id": "macbeth-weighted-values",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.2
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.6
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.3
            }
          ]
        },
        {
          "id": "applied-criteria-weights",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.6
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.4
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "macont",
    "variant": "crisp-sustainable-3prlp-comprehensive-normalization-informatica-2020",
    "source": "MACONT: Mixed Aggregation by Comprehensive Normalization Technique for Multi-Criteria Analysis, Informatica 2020, DOI: 10.15388/20-INFOR417, Tables 2-3 and normalized matrix equations",
    "sourceUrl": "https://www.informatica.vu.lt/journal/INFORMATICA/article/1184/read",
    "doi": "10.15388/20-INFOR417",
    "config": {
      "title": "MACONT validation: Informatica 2020 sustainable third-party reverse logistics provider example",
      "weightingId": "manual",
      "methodParams": {
        "macontLambda": 0.4,
        "macontMu": 0.3,
        "macontDelta": 0.5,
        "macontTheta": 0.5,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "P1",
          "name": "P1"
        },
        {
          "id": "P2",
          "name": "P2"
        },
        {
          "id": "P3",
          "name": "P3"
        },
        {
          "id": "P4",
          "name": "P4"
        },
        {
          "id": "P5",
          "name": "P5"
        },
        {
          "id": "P6",
          "name": "P6"
        },
        {
          "id": "P7",
          "name": "P7"
        },
        {
          "id": "P8",
          "name": "P8"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.048
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.067
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.085
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.026
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.017
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.034
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.098
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "cost",
          "weight": 0.087
        },
        {
          "id": "C9",
          "name": "C9",
          "direction": "benefit",
          "weight": 0.065
        },
        {
          "id": "C10",
          "name": "C10",
          "direction": "benefit",
          "weight": 0.113
        },
        {
          "id": "C11",
          "name": "C11",
          "direction": "benefit",
          "weight": 0.046
        },
        {
          "id": "C12",
          "name": "C12",
          "direction": "benefit",
          "weight": 0.079
        },
        {
          "id": "C13",
          "name": "C13",
          "direction": "benefit",
          "weight": 0.047
        },
        {
          "id": "C14",
          "name": "C14",
          "direction": "benefit",
          "weight": 0.025
        },
        {
          "id": "C15",
          "name": "C15",
          "direction": "benefit",
          "weight": 0.072
        },
        {
          "id": "C16",
          "name": "C16",
          "direction": "benefit",
          "weight": 0.08
        },
        {
          "id": "C17",
          "name": "C17",
          "direction": "benefit",
          "weight": 0.011
        }
      ],
      "values": [
        [
          0.647,
          1,
          1.219512,
          0.459,
          0.443,
          0.5,
          1,
          1.727116,
          0.742,
          0.75,
          1,
          0.329,
          0.521,
          0.848,
          0.625,
          0.62,
          0.453
        ],
        [
          1,
          1.727116,
          2.079002,
          0.905,
          1,
          0.231,
          0.235,
          2.242152,
          0.597,
          0.375,
          0.286,
          0.768,
          0.808,
          0.967,
          0.75,
          0.717,
          0.907
        ],
        [
          0.794,
          1.364256,
          1.531394,
          0.392,
          0.633,
          0.808,
          0.647,
          1.996008,
          0.661,
          0.625,
          0.571,
          0.78,
          1,
          0.87,
          0.5,
          0.804,
          0.573
        ],
        [
          0.559,
          1.862197,
          1.046025,
          0.5,
          0.544,
          1,
          0.529,
          1.618123,
          0.258,
          0.875,
          0.714,
          1,
          0.562,
          0.728,
          0.375,
          0.924,
          0.493
        ],
        [
          0.441,
          3.460208,
          1,
          0.608,
          0.354,
          0.308,
          0.765,
          1,
          0.516,
          0.5,
          0.429,
          0.549,
          0.863,
          0.609,
          0.5,
          0.978,
          0.427
        ],
        [
          0.941,
          1.136364,
          1.968504,
          1,
          0.848,
          0.192,
          0.471,
          2.469136,
          0.387,
          0.25,
          0.571,
          0.463,
          0.712,
          1,
          0.875,
          0.75,
          1
        ],
        [
          0.824,
          3.08642,
          1.706485,
          0.851,
          0.684,
          0.885,
          0.824,
          2.074689,
          1,
          1,
          0.286,
          0.61,
          0.877,
          0.891,
          0.625,
          0.793,
          0.613
        ],
        [
          0.5,
          2.906977,
          1.145475,
          0.568,
          0.392,
          0.731,
          0.941,
          1.30719,
          0.935,
          0.75,
          0.429,
          0.695,
          0.644,
          0.37,
          1,
          1,
          0.52
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "P8",
          "score": 0.4047
        },
        {
          "alternative": "P7",
          "score": 0.3422
        },
        {
          "alternative": "P4",
          "score": 0.2116
        },
        {
          "alternative": "P1",
          "score": 0.2029
        },
        {
          "alternative": "P5",
          "score": 0.1382
        },
        {
          "alternative": "P3",
          "score": 0.0836
        },
        {
          "alternative": "P6",
          "score": -0.3708
        },
        {
          "alternative": "P2",
          "score": -0.374
        }
      ],
      "scores": [
        {
          "alternative": "P1",
          "score": 0.2029
        },
        {
          "alternative": "P2",
          "score": -0.374
        },
        {
          "alternative": "P3",
          "score": 0.0836
        },
        {
          "alternative": "P4",
          "score": 0.2116
        },
        {
          "alternative": "P5",
          "score": 0.1382
        },
        {
          "alternative": "P6",
          "score": -0.3708
        },
        {
          "alternative": "P7",
          "score": 0.3422
        },
        {
          "alternative": "P8",
          "score": 0.4047
        }
      ],
      "tables": [
        {
          "id": "macont-ratio-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.647
            },
            {
              "row": 0,
              "column": 2,
              "value": 1
            },
            {
              "row": 1,
              "column": 5,
              "value": 1
            },
            {
              "row": 7,
              "column": 16,
              "value": 1
            }
          ]
        },
        {
          "id": "macont-integrated-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.35
            },
            {
              "row": 0,
              "column": 7,
              "value": 0.674
            },
            {
              "row": 3,
              "column": 10,
              "value": 0.581
            },
            {
              "row": 7,
              "column": 15,
              "value": 0.676
            }
          ]
        },
        {
          "id": "macont-scores",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0207
            },
            {
              "row": 0,
              "column": 2,
              "value": 1.6741
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.2029
            },
            {
              "row": 7,
              "column": 1,
              "value": 0.0688
            },
            {
              "row": 7,
              "column": 2,
              "value": 2.3379
            },
            {
              "row": 7,
              "column": 5,
              "value": 0.4047
            }
          ]
        }
      ]
    },
    "tolerance": 0.002,
    "notes": "The HTML article exposes the raw decision matrix as an image and the rounded normalized matrices as text. This fixture uses a ratio-equivalent positive input reconstructed from the published ratio-normalized matrix, which preserves the MACONT normalized matrices and final ranking under the paper equations."
  },
  {
    "methodId": "mairca",
    "variant": "crisp-minmax-gap-rmcda-example",
    "source": "RMCDA apply.MAIRCA source implementation and documentation, built June 28 2026, citing the GIS-MAIRCA foundation paper by Gigovic, Pamucar, Bajic, and Milicevic",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/MAIRCA.R",
    "doi": "10.3390/su8040372",
    "config": {
      "title": "MAIRCA validation: RMCDA example",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.04744
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.02464
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.51357
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.41435
        }
      ],
      "values": [
        [
          70,
          245,
          16.4,
          19
        ],
        [
          52,
          246,
          7.3,
          22
        ],
        [
          53,
          295,
          10.3,
          25
        ],
        [
          63,
          256,
          12,
          8
        ],
        [
          64,
          233,
          5.3,
          17
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 0.0332
        },
        {
          "alternative": "A3",
          "score": 0.0654
        },
        {
          "alternative": "A2",
          "score": 0.1122
        },
        {
          "alternative": "A4",
          "score": 0.1304
        },
        {
          "alternative": "A5",
          "score": 0.1498
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.1802
            },
            {
              "row": 2,
              "column": 2,
              "value": 1
            },
            {
              "row": 4,
              "column": 4,
              "value": 0.5294
            }
          ]
        },
        {
          "id": "theoretical-assessment",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0095
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.1027
            },
            {
              "row": 3,
              "column": 4,
              "value": 0.0829
            }
          ]
        },
        {
          "id": "real-assessment",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.1027
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.0682
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.0049
            }
          ]
        },
        {
          "id": "gap",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.004
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.0564
            },
            {
              "row": 4,
              "column": 4,
              "value": 0.039
            }
          ]
        }
      ]
    },
    "tolerance": 0.0003
  },
  {
    "methodId": "mara",
    "variant": "crisp-benefit-cost-area-gap-rmcda-example",
    "source": "RMCDA apply.MARA source implementation example, built 2025, translating the pyDecision MARA implementation and citing the RMCDA package/software reference, DOI: 10.1016/j.simpa.2025.100762",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/MARA.R",
    "doi": "10.1016/j.simpa.2025.100762",
    "config": {
      "title": "MARA validation: RMCDA area-gap example",
      "weightingId": "manual",
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.7
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "cost",
          "weight": 0.3
        }
      ],
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.7
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "cost",
          "weight": 0.3
        }
      ],
      "values": [
        [
          10,
          2
        ],
        [
          20,
          4
        ],
        [
          15,
          5
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A2",
          "score": 0.075
        },
        {
          "alternative": "A1",
          "score": 0.175
        },
        {
          "alternative": "A3",
          "score": 0.1775
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.175
        },
        {
          "alternative": "A2",
          "score": 0.075
        },
        {
          "alternative": "A3",
          "score": 0.1775
        }
      ],
      "tables": [
        {
          "id": "mara-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.5
            },
            {
              "row": 0,
              "column": 2,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.4
            }
          ]
        },
        {
          "id": "mara-weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.35
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.7
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.12
            }
          ]
        },
        {
          "id": "mara-optimal-alternative",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.7
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.3
            }
          ]
        },
        {
          "id": "mara-intensity",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.35
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.3
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.325
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.175
            },
            {
              "row": 1,
              "column": 5,
              "value": 0.075
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.1775
            }
          ]
        },
        {
          "id": "applied-criteria-weights",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.7
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.3
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "marcos",
    "variant": "crisp-utility-normalization-roc-weights",
    "source": "Multi criteria decision making for process parametric optimization of a milling process using the marcos method and different weighing methods, Matéria (Rio de Janeiro), 2026, DOI: 10.1590/1517-7076-RMAT-2025-0857, Tables 2-7",
    "sourceUrl": "https://www.scielo.br/j/rmat/a/Hvrk63YfJLng6kvdxmzwf5k/?lang=en",
    "doi": "10.1590/1517-7076-RMAT-2025-0857",
    "config": {
      "title": "MARCOS validation: milling process with ROC weights",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Utility normalization",
        "marcosScoreMode": "Published range-scaled f(K+) convention",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "1"
        },
        {
          "id": "A2",
          "name": "2"
        },
        {
          "id": "A3",
          "name": "3"
        },
        {
          "id": "A4",
          "name": "4"
        },
        {
          "id": "A5",
          "name": "5"
        },
        {
          "id": "A6",
          "name": "6"
        },
        {
          "id": "A7",
          "name": "7"
        },
        {
          "id": "A8",
          "name": "8"
        },
        {
          "id": "A9",
          "name": "9"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Surface roughness",
          "direction": "cost",
          "weight": 0.75
        },
        {
          "id": "C2",
          "name": "Material removal rate",
          "direction": "benefit",
          "weight": 0.25
        }
      ],
      "values": [
        [
          1.254,
          145.763
        ],
        [
          2.147,
          368.224
        ],
        [
          1.549,
          968.364
        ],
        [
          0.985,
          526.267
        ],
        [
          0.589,
          265.321
        ],
        [
          1.254,
          399.247
        ],
        [
          1.691,
          312.251
        ],
        [
          0.495,
          219.368
        ],
        [
          1.264,
          375.364
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "2",
          "score": 0.786362
        },
        {
          "alternative": "7",
          "score": 0.725509
        },
        {
          "alternative": "1",
          "score": 0.681389
        },
        {
          "alternative": "9",
          "score": 0.631292
        }
      ],
      "tables": [
        {
          "id": "marcos-utility",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.333684
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.156028
            },
            {
              "row": 0,
              "column": 5,
              "value": 0.681389
            },
            {
              "row": 1,
              "column": 5,
              "value": 0.786362
            },
            {
              "row": 6,
              "column": 5,
              "value": 0.725509
            },
            {
              "row": 8,
              "column": 5,
              "value": 0.631292
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "maut",
    "variant": "crisp-input-utilities-manual-weights-linear",
    "source": "Comparative Analysis of Multi-Criteria Decision-Making Methods for Seismic Structural Retrofitting, Computer-Aided Civil and Infrastructure Engineering, 2009, DOI: 10.1111/j.1467-8667.2009.00599.x, MAUT Table 11",
    "sourceUrl": "https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8667.2009.00599.x",
    "doi": "10.1111/j.1467-8667.2009.00599.x",
    "config": {
      "title": "MAUT external validation: seismic structural retrofitting",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Input values are utilities",
        "mautUtilityShape": "Linear",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.08
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.15
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.08
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.28
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.03
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.17
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.03
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "benefit",
          "weight": 0.18
        }
      ],
      "values": [
        [
          0.625,
          0.913333,
          0.6625,
          1,
          0,
          0.958824,
          0.533333,
          0
        ],
        [
          0.25,
          0,
          0,
          0.128571,
          0.633333,
          0,
          0.466667,
          0.777778
        ],
        [
          0.775,
          0.746667,
          0.6625,
          0.528571,
          0.766667,
          0.952941,
          0,
          0.305556
        ],
        [
          0,
          0.173333,
          0.025,
          0.207143,
          0,
          0.976471,
          0.6,
          0.783333
        ],
        [
          0.5125,
          0.78,
          0.775,
          0.207143,
          0.633333,
          0.958824,
          0,
          0.05
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 0.699
        },
        {
          "alternative": "A3",
          "score": 0.615
        },
        {
          "alternative": "A5",
          "score": 0.469
        },
        {
          "alternative": "A4",
          "score": 0.411
        },
        {
          "alternative": "A2",
          "score": 0.229
        }
      ],
      "tables": [
        {
          "id": "utilities",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": 1
            },
            {
              "row": 1,
              "column": 8,
              "value": 0.7778
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.7667
            },
            {
              "row": 4,
              "column": 3,
              "value": 0.775
            }
          ]
        },
        {
          "id": "weighted-utilities",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.05
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.28
            },
            {
              "row": 2,
              "column": 6,
              "value": 0.162
            },
            {
              "row": 3,
              "column": 8,
              "value": 0.141
            },
            {
              "row": 4,
              "column": 3,
              "value": 0.062
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "moora",
    "variant": "crisp-ratio-system-manual-weights",
    "source": "The multi-objective decision making methods based on MULTIMOORA and MOOSRA for the laptop selection problem, Journal of Industrial Engineering International, 2017, DOI: 10.1007/s40092-016-0175-5, Tables 1, 5, and 6",
    "sourceUrl": "https://doi.org/10.1007/s40092-016-0175-5",
    "doi": "10.1007/s40092-016-0175-5",
    "config": {
      "title": "MOORA external validation: laptop selection",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Processor speed",
          "direction": "benefit",
          "weight": 0.297
        },
        {
          "id": "C2",
          "name": "Cache memory",
          "direction": "benefit",
          "weight": 0.025
        },
        {
          "id": "C3",
          "name": "Storage",
          "direction": "benefit",
          "weight": 0.035
        },
        {
          "id": "C4",
          "name": "Display card memory",
          "direction": "benefit",
          "weight": 0.076
        },
        {
          "id": "C5",
          "name": "RAM",
          "direction": "benefit",
          "weight": 0.154
        },
        {
          "id": "C6",
          "name": "Screen resolution",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "C7",
          "name": "Screen size",
          "direction": "benefit",
          "weight": 0.104
        },
        {
          "id": "C8",
          "name": "Brand reliability",
          "direction": "benefit",
          "weight": 0.017
        },
        {
          "id": "C9",
          "name": "Weight",
          "direction": "cost",
          "weight": 0.025
        },
        {
          "id": "C10",
          "name": "Cost",
          "direction": "cost",
          "weight": 0.214
        }
      ],
      "values": [
        [
          3.5,
          6,
          1256,
          4,
          16,
          3,
          17.3,
          8,
          2.82,
          4100
        ],
        [
          3.1,
          4,
          1000,
          2,
          8,
          1,
          15.6,
          5,
          3.08,
          3800
        ],
        [
          3.6,
          6,
          2000,
          4,
          16,
          3,
          17.3,
          5,
          2.9,
          4000
        ],
        [
          3,
          4,
          1000,
          2,
          8,
          2,
          17.3,
          5,
          2.6,
          3500
        ],
        [
          3.3,
          6,
          1008,
          4,
          12,
          3,
          15.6,
          8,
          2.3,
          3800
        ],
        [
          3.6,
          6,
          1000,
          2,
          16,
          3,
          15.6,
          5,
          2.8,
          4000
        ],
        [
          3.5,
          6,
          1256,
          2,
          16,
          1,
          15.6,
          6,
          2.9,
          4000
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A3",
          "score": 0.236
        },
        {
          "alternative": "A1",
          "score": 0.226
        },
        {
          "alternative": "A5",
          "score": 0.203
        },
        {
          "alternative": "A6",
          "score": 0.202
        },
        {
          "alternative": "A7",
          "score": 0.186
        },
        {
          "alternative": "A4",
          "score": 0.152
        },
        {
          "alternative": "A2",
          "score": 0.135
        }
      ],
      "tables": [
        {
          "id": "moora-net",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.321
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.095
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.226
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.224
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.089
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.135
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.329
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.093
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.236
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "moosra",
    "variant": "crisp-benefit-cost-ratio-manual-weights",
    "source": "The multi-objective decision making methods based on MULTIMOORA and MOOSRA for the laptop selection problem, Journal of Industrial Engineering International, 2017, DOI: 10.1007/s40092-016-0175-5, Tables 1, 5, and 10",
    "sourceUrl": "https://doi.org/10.1007/s40092-016-0175-5",
    "doi": "10.1007/s40092-016-0175-5",
    "config": {
      "title": "MOOSRA external validation: laptop selection",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Processor speed",
          "direction": "benefit",
          "weight": 0.297
        },
        {
          "id": "C2",
          "name": "Cache memory",
          "direction": "benefit",
          "weight": 0.025
        },
        {
          "id": "C3",
          "name": "Storage",
          "direction": "benefit",
          "weight": 0.035
        },
        {
          "id": "C4",
          "name": "Display card memory",
          "direction": "benefit",
          "weight": 0.076
        },
        {
          "id": "C5",
          "name": "RAM",
          "direction": "benefit",
          "weight": 0.154
        },
        {
          "id": "C6",
          "name": "Screen resolution",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "C7",
          "name": "Screen size",
          "direction": "benefit",
          "weight": 0.104
        },
        {
          "id": "C8",
          "name": "Brand reliability",
          "direction": "benefit",
          "weight": 0.017
        },
        {
          "id": "C9",
          "name": "Weight",
          "direction": "cost",
          "weight": 0.025
        },
        {
          "id": "C10",
          "name": "Cost",
          "direction": "cost",
          "weight": 0.214
        }
      ],
      "values": [
        [
          3.5,
          6,
          1256,
          4,
          16,
          3,
          17.3,
          8,
          2.82,
          4100
        ],
        [
          3.1,
          4,
          1000,
          2,
          8,
          1,
          15.6,
          5,
          3.08,
          3800
        ],
        [
          3.6,
          6,
          2000,
          4,
          16,
          3,
          17.3,
          5,
          2.9,
          4000
        ],
        [
          3,
          4,
          1000,
          2,
          8,
          2,
          17.3,
          5,
          2.6,
          3500
        ],
        [
          3.3,
          6,
          1008,
          4,
          12,
          3,
          15.6,
          8,
          2.3,
          3800
        ],
        [
          3.6,
          6,
          1000,
          2,
          16,
          3,
          15.6,
          5,
          2.8,
          4000
        ],
        [
          3.5,
          6,
          1256,
          2,
          16,
          1,
          15.6,
          6,
          2.9,
          4000
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A3",
          "score": 3.533
        },
        {
          "alternative": "A1",
          "score": 3.382
        },
        {
          "alternative": "A5",
          "score": 3.343
        },
        {
          "alternative": "A6",
          "score": 3.184
        },
        {
          "alternative": "A7",
          "score": 3.001
        },
        {
          "alternative": "A4",
          "score": 2.86
        },
        {
          "alternative": "A2",
          "score": 2.509
        }
      ],
      "tables": [
        {
          "id": "moosra-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.321
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.095
            },
            {
              "row": 0,
              "column": 3,
              "value": 3.382
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.224
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.089
            },
            {
              "row": 1,
              "column": 3,
              "value": 2.509
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.329
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.093
            },
            {
              "row": 2,
              "column": 3,
              "value": 3.533
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "multimoora",
    "variant": "crisp-dominance-theory-manual-weights",
    "source": "The multi-objective decision making methods based on MULTIMOORA and MOOSRA for the laptop selection problem, Journal of Industrial Engineering International, 2017, DOI: 10.1007/s40092-016-0175-5, Tables 1, 5, 6, 7, 8, and 9",
    "sourceUrl": "https://doi.org/10.1007/s40092-016-0175-5",
    "doi": "10.1007/s40092-016-0175-5",
    "config": {
      "title": "MULTIMOORA external validation: laptop selection",
      "weightingId": "manual",
      "methodParams": {
        "multimooraAggregation": "Dominance theory",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Processor speed",
          "direction": "benefit",
          "weight": 0.297
        },
        {
          "id": "C2",
          "name": "Cache memory",
          "direction": "benefit",
          "weight": 0.025
        },
        {
          "id": "C3",
          "name": "Storage",
          "direction": "benefit",
          "weight": 0.035
        },
        {
          "id": "C4",
          "name": "Display card memory",
          "direction": "benefit",
          "weight": 0.076
        },
        {
          "id": "C5",
          "name": "RAM",
          "direction": "benefit",
          "weight": 0.154
        },
        {
          "id": "C6",
          "name": "Screen resolution",
          "direction": "benefit",
          "weight": 0.053
        },
        {
          "id": "C7",
          "name": "Screen size",
          "direction": "benefit",
          "weight": 0.104
        },
        {
          "id": "C8",
          "name": "Brand reliability",
          "direction": "benefit",
          "weight": 0.017
        },
        {
          "id": "C9",
          "name": "Weight",
          "direction": "cost",
          "weight": 0.025
        },
        {
          "id": "C10",
          "name": "Cost",
          "direction": "cost",
          "weight": 0.214
        }
      ],
      "values": [
        [
          3.5,
          6,
          1256,
          4,
          16,
          3,
          17.3,
          8,
          2.82,
          4100
        ],
        [
          3.1,
          4,
          1000,
          2,
          8,
          1,
          15.6,
          5,
          3.08,
          3800
        ],
        [
          3.6,
          6,
          2000,
          4,
          16,
          3,
          17.3,
          5,
          2.9,
          4000
        ],
        [
          3,
          4,
          1000,
          2,
          8,
          2,
          17.3,
          5,
          2.6,
          3500
        ],
        [
          3.3,
          6,
          1008,
          4,
          12,
          3,
          15.6,
          8,
          2.3,
          3800
        ],
        [
          3.6,
          6,
          1000,
          2,
          16,
          3,
          15.6,
          5,
          2.8,
          4000
        ],
        [
          3.5,
          6,
          1256,
          2,
          16,
          1,
          15.6,
          6,
          2.9,
          4000
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A3"
        },
        {
          "alternative": "A1"
        },
        {
          "alternative": "A5"
        },
        {
          "alternative": "A6"
        },
        {
          "alternative": "A7"
        },
        {
          "alternative": "A4"
        },
        {
          "alternative": "A2"
        }
      ],
      "tables": [
        {
          "id": "multimoora-components",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.226
            },
            {
              "row": 0,
              "column": 7,
              "value": 6
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.135
            },
            {
              "row": 1,
              "column": 7,
              "value": 20
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.236
            },
            {
              "row": 2,
              "column": 7,
              "value": 3
            }
          ]
        }
      ],
      "diagnostics": [
        {
          "label": "MULTIMOORA aggregation",
          "status": "pass"
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "ocra",
    "variant": "crisp-relative-distance-manual-weights-tablet-selection",
    "source": "OCRA tablet-computer selection worked example in JMcDM documentation, citing Parkan OCRA foundations, DOI: 10.1002/mde.4090150303, and Kundakci 2017 tablet selection example",
    "sourceUrl": "https://jbytecode.github.io/JMcDM/stable/mcdms/",
    "doi": "10.1002/mde.4090150303",
    "config": {
      "title": "OCRA external validation: tablet computer selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.167
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "benefit",
          "weight": 0.039
        },
        {
          "id": "C3",
          "name": "Criterion 3",
          "direction": "benefit",
          "weight": 0.247
        },
        {
          "id": "C4",
          "name": "Criterion 4",
          "direction": "benefit",
          "weight": 0.247
        },
        {
          "id": "C5",
          "name": "Criterion 5",
          "direction": "benefit",
          "weight": 0.116
        },
        {
          "id": "C6",
          "name": "Criterion 6",
          "direction": "benefit",
          "weight": 0.02
        },
        {
          "id": "C7",
          "name": "Criterion 7",
          "direction": "benefit",
          "weight": 0.056
        },
        {
          "id": "C8",
          "name": "Criterion 8",
          "direction": "cost",
          "weight": 0.027
        },
        {
          "id": "C9",
          "name": "Criterion 9",
          "direction": "cost",
          "weight": 0.081
        }
      ],
      "values": [
        [
          8,
          16,
          1.5,
          1.2,
          4200,
          5,
          5,
          314,
          185
        ],
        [
          8,
          16,
          1,
          1.3,
          4200,
          5,
          4,
          360,
          156
        ],
        [
          10.1,
          16,
          2,
          1.3,
          4060,
          5,
          3,
          503,
          160
        ],
        [
          10.1,
          8,
          1,
          1.5,
          5070,
          2,
          4,
          525,
          200
        ],
        [
          10,
          16,
          2,
          1.2,
          6350,
          5,
          3,
          560,
          190
        ],
        [
          10.1,
          16,
          1,
          1.2,
          5500,
          2,
          2,
          521,
          159
        ],
        [
          10.1,
          64,
          2,
          1.7,
          5240,
          5,
          3,
          770,
          199
        ],
        [
          7,
          32,
          1,
          1.8,
          3000,
          3,
          4,
          364,
          157
        ],
        [
          10.1,
          16,
          1,
          1.3,
          3540,
          5,
          3,
          510,
          171
        ],
        [
          9.7,
          16,
          2,
          1.83,
          7500,
          6,
          2,
          550,
          170
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A7",
          "score": 0.5921715172
        },
        {
          "alternative": "A10",
          "score": 0.4787485498
        },
        {
          "alternative": "A5",
          "score": 0.318519538
        },
        {
          "alternative": "A3",
          "score": 0.273420116
        },
        {
          "alternative": "A1",
          "score": 0.1439209391
        },
        {
          "alternative": "A8",
          "score": 0.1139028947
        },
        {
          "alternative": "A4",
          "score": 0.0429791654
        },
        {
          "alternative": "A2",
          "score": 0.0241065507
        },
        {
          "alternative": "A6",
          "score": 0.0024882427
        },
        {
          "alternative": "A9",
          "score": 0
        }
      ],
      "tables": [
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0238571429
            },
            {
              "row": 0,
              "column": 8,
              "value": 0.0392101911
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.273
            },
            {
              "row": 6,
              "column": 9,
              "value": 0.0005192308
            }
          ]
        },
        {
          "id": "ocra-components",
          "cells": [
            {
              "row": 6,
              "column": 1,
              "value": 0.8414871429
            },
            {
              "row": 6,
              "column": 4,
              "value": 0.5921715172
            },
            {
              "row": 8,
              "column": 3,
              "value": 0.2498348564
            },
            {
              "row": 8,
              "column": 4,
              "value": 0
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "oreste",
    "variant": "crisp-alpha-rank-rmcda-example",
    "source": "RMCDA apply.ORESTE official source implementation and worked example, RMCDA Software Impacts package paper, 2025, DOI: 10.1016/j.simpa.2025.100762",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/ORESTE.R",
    "doi": "10.1016/j.simpa.2025.100762",
    "config": {
      "title": "ORESTE external validation: alpha rank blending example",
      "weightingId": "manual",
      "methodParams": {
        "oresteAlpha": 0.4,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Benefit criterion",
          "direction": "benefit",
          "weight": 0.7
        },
        {
          "id": "C2",
          "name": "Cost criterion",
          "direction": "cost",
          "weight": 0.3
        }
      ],
      "values": [
        [
          10,
          2
        ],
        [
          20,
          4
        ],
        [
          15,
          5
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A2",
          "score": 6
        },
        {
          "alternative": "A1",
          "score": 7
        },
        {
          "alternative": "A3",
          "score": 8
        }
      ],
      "tables": [
        {
          "id": "oreste-criterion-ranks",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 1
            },
            {
              "row": 1,
              "column": 3,
              "value": 2
            }
          ]
        },
        {
          "id": "oreste-alternative-ranks",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 3
            },
            {
              "row": 0,
              "column": 2,
              "value": 1
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 3
            }
          ]
        },
        {
          "id": "oreste-individual-rank-index",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1.8
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 2.4
            }
          ]
        },
        {
          "id": "oreste-global-projection-ranks",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 4
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 2,
              "value": 6
            }
          ]
        },
        {
          "id": "oreste-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 7
            },
            {
              "row": 1,
              "column": 1,
              "value": 6
            },
            {
              "row": 2,
              "column": 1,
              "value": 8
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "piv",
    "variant": "crisp-vector-normalization-combined-weights-electric-vehicle",
    "source": "Applying MCDM Methods for Electric Vehicle Selection: A Comparative Study Between CRADIS and PIV Methods, Journal of Applied Engineering Science, 2025, DOI: 10.5937/jaes0-56793, Tables 2-5",
    "sourceUrl": "https://www.engineeringscience.rs/articles/applying-mcdm-methods-for-electric-vehicle-selection-a-comparative-study-between-cradis-and-piv-methods",
    "doi": "10.5937/jaes0-56793",
    "config": {
      "title": "PIV validation: electric vehicle selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Vector normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "TOGG T10F 218 PS"
        },
        {
          "id": "A2",
          "name": "Xiaomi SU7 295 HP"
        },
        {
          "id": "A3",
          "name": "Ssangyong Torres EVX 207 PS"
        },
        {
          "id": "A4",
          "name": "Renault 5 E-Tech 150 HP"
        },
        {
          "id": "A5",
          "name": "Hyundai IOVIQ 6 151 BG Progressive"
        },
        {
          "id": "A6",
          "name": "Kia EV3 204 PS GT Line"
        },
        {
          "id": "A7",
          "name": "Opel Combo 136 HP Edition"
        },
        {
          "id": "A8",
          "name": "Volvo EX30 272 HP"
        },
        {
          "id": "A9",
          "name": "Tesla Cybertruck Cyberbrast 845 HP"
        },
        {
          "id": "A10",
          "name": "Citroen e-C3 113 BG"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Range",
          "direction": "cost",
          "weight": 0.0658
        },
        {
          "id": "C2",
          "name": "Fast Charging",
          "direction": "cost",
          "weight": 0.0526
        },
        {
          "id": "C3",
          "name": "Acceleration",
          "direction": "cost",
          "weight": 0.2426
        },
        {
          "id": "C4",
          "name": "Energy Consumption",
          "direction": "cost",
          "weight": 0.0052
        },
        {
          "id": "C5",
          "name": "Battery Capacity",
          "direction": "benefit",
          "weight": 0.0956
        },
        {
          "id": "C6",
          "name": "Top Speed",
          "direction": "benefit",
          "weight": 0.0066
        },
        {
          "id": "C7",
          "name": "Maximum Torque",
          "direction": "benefit",
          "weight": 0.5317
        }
      ],
      "values": [
        [
          350,
          28,
          7.2,
          16,
          52.4,
          180,
          350
        ],
        [
          668,
          15,
          5.3,
          12.5,
          73.6,
          210,
          400
        ],
        [
          635,
          37,
          8.11,
          18.6,
          73.4,
          175,
          339
        ],
        [
          400,
          26,
          7.5,
          13,
          52,
          150,
          245
        ],
        [
          429,
          32,
          8.8,
          16.1,
          53,
          185,
          350
        ],
        [
          584,
          29,
          7.9,
          14.9,
          81.4,
          170,
          283
        ],
        [
          346,
          30,
          11.7,
          19.5,
          50,
          132,
          270
        ],
        [
          344,
          26,
          5.4,
          16.7,
          51,
          180,
          343
        ],
        [
          515,
          15,
          2.7,
          15.4,
          123,
          209,
          740
        ],
        [
          320,
          26,
          11,
          16.4,
          45,
          135,
          120
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Tesla Cybertruck Cyberbrast 845 HP",
          "score": 0.009
        },
        {
          "alternative": "Xiaomi SU7 295 HP",
          "score": 0.214
        },
        {
          "alternative": "Volvo EX30 272 HP",
          "score": 0.244
        },
        {
          "alternative": "TOGG T10F 218 PS",
          "score": 0.259
        },
        {
          "alternative": "Hyundai IOVIQ 6 151 BG Progressive",
          "score": 0.28
        },
        {
          "alternative": "Ssangyong Torres EVX 207 PS",
          "score": 0.281
        },
        {
          "alternative": "Kia EV3 204 PS GT Line",
          "score": 0.293
        },
        {
          "alternative": "Renault 5 E-Tech 150 HP",
          "score": 0.31
        },
        {
          "alternative": "Opel Combo 136 HP Edition",
          "score": 0.341
        },
        {
          "alternative": "Citroen e-C3 113 BG",
          "score": 0.399
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.2327
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.1744
            },
            {
              "row": 8,
              "column": 7,
              "value": 0.6228
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": 0.0692
            },
            {
              "row": 1,
              "column": 7,
              "value": 0.1789
            },
            {
              "row": 8,
              "column": 7,
              "value": 0.3311
            }
          ]
        },
        {
          "id": "piv-weighted-proximity",
          "cells": [
            {
              "row": 0,
              "column": 7,
              "value": 0.1745
            },
            {
              "row": 1,
              "column": 2,
              "value": 0
            },
            {
              "row": 8,
              "column": 7,
              "value": 0
            }
          ]
        },
        {
          "id": "piv-proximity",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.259
            },
            {
              "row": 8,
              "column": 1,
              "value": 0.009
            },
            {
              "row": 9,
              "column": 1,
              "value": 0.399
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "probid",
    "variant": "crisp-vector-normalization-ideal-average-distance-pymcdm-example",
    "source": "pymcdm PROBID documentation example, crawled 2026, citing Preference ranking on the basis of ideal-average distance method for multi-criteria decision-making, Industrial & Engineering Chemistry Research, 2021, DOI: 10.1021/acs.iecr.1c01453",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.PROBID",
    "doi": "10.1021/acs.iecr.1c01453",
    "config": {
      "title": "PROBID validation: pymcdm documentation example",
      "weightingId": "manual",
      "methodParams": {
        "probidReference": "Ideal-average distance",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        },
        {
          "id": "A11",
          "name": "A11"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.1819
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.2131
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.1838
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.1832
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.2379
        }
      ],
      "values": [
        [
          1679000,
          1.525e-7,
          0.00003747,
          0.251,
          2.917
        ],
        [
          2213000,
          1.304e-7,
          0.0000325,
          0.218,
          6.633
        ],
        [
          2461000,
          1.445e-7,
          0.00003854,
          0.259,
          0.553
        ],
        [
          2854000,
          1.54e-7,
          0.0000397,
          0.266,
          1.597
        ],
        [
          3107000,
          1.522e-7,
          0.00003779,
          0.254,
          2.905
        ],
        [
          3574000,
          1.469e-7,
          0.00003297,
          0.221,
          6.378
        ],
        [
          3932000,
          1.977e-7,
          0.00003129,
          0.21,
          11.381
        ],
        [
          4383000,
          1.292e-7,
          0.00003142,
          0.211,
          9.929
        ],
        [
          4988000,
          1.69e-7,
          0.00003767,
          0.253,
          8.459
        ],
        [
          5497000,
          5.703e-7,
          0.00003012,
          0.2,
          18.918
        ],
        [
          5751000,
          4.653e-7,
          0.00003017,
          0.201,
          17.517
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A5",
          "score": 0.9379
        },
        {
          "alternative": "A4",
          "score": 0.9369
        },
        {
          "alternative": "A3",
          "score": 0.9362
        },
        {
          "alternative": "A6",
          "score": 0.8716
        },
        {
          "alternative": "A1",
          "score": 0.8568
        },
        {
          "alternative": "A2",
          "score": 0.7826
        },
        {
          "alternative": "A9",
          "score": 0.7792
        },
        {
          "alternative": "A8",
          "score": 0.7231
        },
        {
          "alternative": "A7",
          "score": 0.5489
        },
        {
          "alternative": "A11",
          "score": 0.3387
        },
        {
          "alternative": "A10",
          "score": 0.3331
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1299
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.0889
            },
            {
              "row": 9,
              "column": 2,
              "value": 0.656
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0236
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.0211
            },
            {
              "row": 9,
              "column": 2,
              "value": 0.1398
            }
          ]
        },
        {
          "id": "probid-distances",
          "cells": [
            {
              "row": 0,
              "column": 5,
              "value": 0.8568
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.9379
            },
            {
              "row": 9,
              "column": 5,
              "value": 0.3331
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "promethee",
    "variant": "crisp-usual-hand-computed-r-package",
    "source": "surveyframe R package PROMETHEE II hand-computed test case, usual preference function, with standard PROMETHEE reference DOI 10.1007/978-1-4939-3094-4_6",
    "sourceUrl": "https://rdrr.io/cran/surveyframe/src/tests/testthat/test-decision-preference.R",
    "doi": "10.1007/978-1-4939-3094-4_6",
    "config": {
      "title": "PROMETHEE II external validation: hand-computed usual preference flows",
      "weightingId": "manual",
      "methodParams": {
        "preferenceFunction": "Usual",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "c1",
          "direction": "benefit",
          "weight": 0.8
        },
        {
          "id": "C2",
          "name": "c2",
          "direction": "benefit",
          "weight": 0.2
        }
      ],
      "values": [
        [
          1,
          4
        ],
        [
          2,
          2
        ],
        [
          3,
          1
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A3",
          "score": 0.6
        },
        {
          "alternative": "A2",
          "score": 0
        },
        {
          "alternative": "A1",
          "score": -0.6
        }
      ],
      "tables": [
        {
          "id": "preference-index",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.2
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.8
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.2
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.8
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.8
            }
          ]
        },
        {
          "id": "flows",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.2
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.8
            },
            {
              "row": 0,
              "column": 3,
              "value": -0.6
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.5
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.5
            },
            {
              "row": 1,
              "column": 3,
              "value": 0
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.8
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.2
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.6
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "psi",
    "variant": "crisp-alternative-preference-index-jmcdm",
    "source": "JMcDM PSI worked example, generated documentation dated 2025-04-29, citing Maniya and Bhatt 2010 Materials & Design PSI foundations",
    "sourceUrl": "https://jbytecode.github.io/JMcDM/stable/mcdms/#PSI",
    "doi": "10.1016/j.matdes.2009.11.020",
    "config": {
      "title": "PSI validation: JMcDM material-selection worked example",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "psiScoreMode": "Alternative preference index",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.166667
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.166667
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.166667
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.166667
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.166667
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.166667
        }
      ],
      "values": [
        [
          3,
          12.5,
          2,
          120,
          14,
          3
        ],
        [
          5,
          15,
          3,
          110,
          38,
          4
        ],
        [
          3,
          13,
          2,
          120,
          19,
          3
        ],
        [
          4,
          14,
          2,
          100,
          31,
          4
        ],
        [
          3,
          15,
          1.5,
          125,
          40,
          4
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 1.1252
        },
        {
          "alternative": "A3",
          "score": 1.106
        },
        {
          "alternative": "A4",
          "score": 1.006
        },
        {
          "alternative": "A5",
          "score": 0.7866
        },
        {
          "alternative": "A2",
          "score": 0.7626
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 1.1252
        },
        {
          "alternative": "A2",
          "score": 0.7626
        },
        {
          "alternative": "A3",
          "score": 1.106
        },
        {
          "alternative": "A4",
          "score": 1.006
        },
        {
          "alternative": "A5",
          "score": 0.7866
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.6
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.833333
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.35
            }
          ]
        },
        {
          "id": "psi-preference-indexes",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1393
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.2224
            },
            {
              "row": 0,
              "column": 4,
              "value": 1.125248
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.762593
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "pugh",
    "variant": "crisp-uploaded-score-global-rescale-travel-selection",
    "source": "Public Pugh travel-selection worked example from arthurrichards77/mcdm, following Mistree, Lewis, and Stonis, Selection in the Conceptual Design of Aircraft, AIAA-94-4382, 1994, DOI: 10.2514/6.1994-4382",
    "sourceUrl": "https://github.com/arthurrichards77/mcdm",
    "doi": "10.2514/6.1994-4382",
    "config": {
      "title": "Pugh external validation: travel selection",
      "weightingId": "manual",
      "methodParams": {
        "pughScoringMode": "Use uploaded Pugh scores",
        "pughScoreTransform": "Global 0-1 rescale",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "Car",
          "name": "Car"
        },
        {
          "id": "Train",
          "name": "Train"
        },
        {
          "id": "Plane",
          "name": "Plane"
        }
      ],
      "criteria": [
        {
          "id": "Price",
          "name": "Price",
          "direction": "benefit",
          "weight": 0.2
        },
        {
          "id": "Speed",
          "name": "Speed",
          "direction": "benefit",
          "weight": 0.1
        },
        {
          "id": "Work",
          "name": "Work",
          "direction": "benefit",
          "weight": 0.3
        },
        {
          "id": "Conv",
          "name": "Convenience",
          "direction": "benefit",
          "weight": 0.3
        },
        {
          "id": "Env",
          "name": "Environment",
          "direction": "benefit",
          "weight": 0.1
        }
      ],
      "values": [
        [
          3,
          -2,
          -2,
          3,
          0
        ],
        [
          0,
          0,
          2,
          0,
          3
        ],
        [
          -3,
          3,
          0,
          -3,
          -2
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Train",
          "score": 0.65
        },
        {
          "alternative": "Car",
          "score": 0.6167
        },
        {
          "alternative": "Plane",
          "score": 0.2667
        }
      ],
      "tables": [
        {
          "id": "pugh-relative-scores",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 3
            },
            {
              "row": 2,
              "column": 2,
              "value": 3
            },
            {
              "row": 1,
              "column": 5,
              "value": 3
            }
          ]
        },
        {
          "id": "pugh-transformed-scores",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.1667
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.8333
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.1667
            }
          ]
        },
        {
          "id": "pugh-weighted-scores",
          "cells": [
            {
              "row": 1,
              "column": 3,
              "value": 0.25
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.3
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.1
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "qualiflex",
    "variant": "crisp-lpg-bunker-springer-2019",
    "source": "QUALIFLEX Method chapter in New Methods and Applications in Multiple Attribute Decision Making (MADM), Springer, 2019, DOI: 10.1007/978-3-030-15009-9_6, Figures 6.1-6.2 and Table 6.1",
    "sourceUrl": "https://link.springer.com/chapter/10.1007/978-3-030-15009-9_6",
    "doi": "10.1007/978-3-030-15009-9_6",
    "config": {
      "title": "QUALIFLEX validation: LPG bunker selection",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload",
        "qualiflexExactLimit": 7
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Price",
          "direction": "cost",
          "weight": 0.3333333333333333
        },
        {
          "id": "C2",
          "name": "Working pressure",
          "direction": "benefit",
          "weight": 0.3333333333333333
        },
        {
          "id": "C3",
          "name": "Capacity",
          "direction": "benefit",
          "weight": 0.3333333333333333
        }
      ],
      "values": [
        [
          1.2,
          18,
          32000
        ],
        [
          2,
          23,
          24000
        ],
        [
          2,
          15,
          25000
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1"
        },
        {
          "alternative": "A2"
        },
        {
          "alternative": "A3"
        }
      ],
      "tables": [
        {
          "id": "qualiflex-permutation-summary",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 6
            },
            {
              "row": 0,
              "column": 2,
              "value": 1.333
            },
            {
              "row": 0,
              "column": 3,
              "value": "A1 > A2 > A3"
            }
          ]
        },
        {
          "id": "qualiflex-pairwise",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": 0.3333
            },
            {
              "row": 0,
              "column": 3,
              "value": 1
            },
            {
              "row": 2,
              "column": 1,
              "value": -1
            }
          ]
        }
      ]
    },
    "tolerance": 0.0015
  },
  {
    "methodId": "rafsi",
    "variant": "crisp-manual-reference-r-package-example",
    "source": "rafsi R package README/vignette example, built Sept. 30 2024, citing Rank Reversal Problem Using a New Multi-Attribute Model - RAFSI Method for Multi-Criteria Decision Making, Mathematics, 2020, DOI: 10.3390/math8061015",
    "sourceUrl": "https://rdrr.io/cran/rafsi/f/README.md",
    "doi": "10.3390/math8061015",
    "config": {
      "title": "RAFSI validation: rafsi R package example",
      "weightingId": "manual",
      "methodParams": {
        "rafsiReferenceMode": "Manual reference values",
        "rafsiIntervalLower": 1,
        "rafsiIntervalUpper": 6,
        "rafsiIdealValues": "200,6,10,200,8",
        "rafsiAntiIdealValues": "120,12,20,100,2",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.35
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.25
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.15
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.15
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.1
        }
      ],
      "values": [
        [
          180,
          10.5,
          15.5,
          160,
          3.7
        ],
        [
          165,
          9.2,
          16.5,
          131,
          5
        ],
        [
          160,
          8.8,
          14,
          125,
          4.5
        ],
        [
          170,
          9.5,
          16,
          135,
          3.4
        ],
        [
          185,
          10,
          14.5,
          143,
          4.3
        ],
        [
          167,
          8.9,
          15.1,
          140,
          4.1
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A5",
          "score": 0.4513
        },
        {
          "alternative": "A1",
          "score": 0.4371
        },
        {
          "alternative": "A6",
          "score": 0.3994
        },
        {
          "alternative": "A2",
          "score": 0.384
        },
        {
          "alternative": "A4",
          "score": 0.383
        },
        {
          "alternative": "A3",
          "score": 0.3744
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.4371
        },
        {
          "alternative": "A2",
          "score": 0.384
        },
        {
          "alternative": "A3",
          "score": 0.3744
        },
        {
          "alternative": "A4",
          "score": 0.383
        },
        {
          "alternative": "A5",
          "score": 0.4513
        },
        {
          "alternative": "A6",
          "score": 0.3994
        }
      ],
      "tables": [
        {
          "id": "rafsi-reference-values",
          "cells": [
            {
              "row": 0,
              "column": 5,
              "value": 120
            },
            {
              "row": 0,
              "column": 6,
              "value": 200
            },
            {
              "row": 1,
              "column": 5,
              "value": 12
            },
            {
              "row": 1,
              "column": 6,
              "value": 6
            }
          ]
        },
        {
          "id": "rafsi-mapped",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 4.75
            },
            {
              "row": 2,
              "column": 3,
              "value": 3
            },
            {
              "row": 4,
              "column": 1,
              "value": 5.0625
            }
          ]
        },
        {
          "id": "rafsi-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.6786
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.2338
            },
            {
              "row": 5,
              "column": 5,
              "value": 0.3929
            }
          ]
        },
        {
          "id": "rafsi-weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.2375
            },
            {
              "row": 4,
              "column": 1,
              "value": 0.2531
            },
            {
              "row": 5,
              "column": 4,
              "value": 0.0643
            }
          ]
        },
        {
          "id": "rafsi-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.4371
            },
            {
              "row": 4,
              "column": 1,
              "value": 0.4513
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "ram",
    "variant": "crisp-column-sum-root-assessment-pymcdm-example",
    "source": "pymcdm RAM documentation example, crawled 2026, citing Root Assessment Method (RAM): A novel multi-criteria decision making method and its applications in sustainability challenges, Journal of Cleaner Production, 2023, DOI: 10.1016/j.jclepro.2023.138695",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.RAM",
    "doi": "10.1016/j.jclepro.2023.138695",
    "config": {
      "title": "RAM validation: pymcdm documentation example",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Column-sum normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.132
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.135
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.138
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "benefit",
          "weight": 0.162
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "benefit",
          "weight": 0.09
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "benefit",
          "weight": 0.223
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "benefit",
          "weight": 0.12
        }
      ],
      "values": [
        [
          0.068,
          0.066,
          0.15,
          0.098,
          0.156,
          0.114,
          0.098
        ],
        [
          0.078,
          0.076,
          0.108,
          0.136,
          0.082,
          0.171,
          0.105
        ],
        [
          0.157,
          0.114,
          0.128,
          0.083,
          0.108,
          0.113,
          0.131
        ],
        [
          0.106,
          0.139,
          0.058,
          0.074,
          0.132,
          0.084,
          0.12
        ],
        [
          0.103,
          0.187,
          0.125,
          0.176,
          0.074,
          0.064,
          0.057
        ],
        [
          0.105,
          0.083,
          0.15,
          0.051,
          0.134,
          0.094,
          0.113
        ],
        [
          0.137,
          0.127,
          0.056,
          0.133,
          0.122,
          0.119,
          0.114
        ],
        [
          0.1,
          0.082,
          0.086,
          0.06,
          0.062,
          0.109,
          0.093
        ],
        [
          0.053,
          0.052,
          0.043,
          0.1,
          0.05,
          0.078,
          0.063
        ],
        [
          0.094,
          0.074,
          0.097,
          0.087,
          0.08,
          0.054,
          0.106
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A7",
          "score": 1.4394
        },
        {
          "alternative": "A2",
          "score": 1.4392
        },
        {
          "alternative": "A3",
          "score": 1.4353
        },
        {
          "alternative": "A1",
          "score": 1.4332
        },
        {
          "alternative": "A4",
          "score": 1.4322
        },
        {
          "alternative": "A8",
          "score": 1.4308
        },
        {
          "alternative": "A6",
          "score": 1.4301
        },
        {
          "alternative": "A9",
          "score": 1.4294
        },
        {
          "alternative": "A10",
          "score": 1.4288
        },
        {
          "alternative": "A5",
          "score": 1.4279
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0679
            },
            {
              "row": 1,
              "column": 6,
              "value": 0.171
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.0559
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.009
            },
            {
              "row": 1,
              "column": 4,
              "value": 0.0221
            },
            {
              "row": 6,
              "column": 7,
              "value": 0.0137
            }
          ]
        },
        {
          "id": "ram-components",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0761
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.0296
            },
            {
              "row": 6,
              "column": 3,
              "value": 1.4394
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "rawec",
    "variant": "crisp-double-normalization-lmaw-weights-agricultural-distribution-center",
    "source": "Introducing a Novel multi-criteria Ranking of Alternatives with Weights of Criterion (RAWEC) model, MethodsX, 2024, DOI: 10.1016/j.mex.2024.102628, Tables 5-7",
    "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC11636910/",
    "doi": "10.1016/j.mex.2024.102628",
    "config": {
      "title": "RAWEC validation: agricultural distribution-center location selection",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.112221
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "benefit",
          "weight": 0.102772
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.112209
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.104884
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.110744
        },
        {
          "id": "C6",
          "name": "C6",
          "direction": "cost",
          "weight": 0.042561
        },
        {
          "id": "C7",
          "name": "C7",
          "direction": "cost",
          "weight": 0.102662
        },
        {
          "id": "C8",
          "name": "C8",
          "direction": "cost",
          "weight": 0.089373
        },
        {
          "id": "C9",
          "name": "C9",
          "direction": "benefit",
          "weight": 0.110356
        },
        {
          "id": "C10",
          "name": "C10",
          "direction": "cost",
          "weight": 0.112216
        }
      ],
      "values": [
        [
          5.8,
          35.9,
          2.6,
          10,
          3.2,
          75,
          35,
          8,
          6.6,
          3.4
        ],
        [
          6.6,
          36,
          2.6,
          25,
          3,
          70,
          25,
          5,
          6.4,
          4.2
        ],
        [
          3.6,
          20.8,
          4.8,
          5,
          4.8,
          70,
          35,
          10,
          3.4,
          4.6
        ],
        [
          5.4,
          37,
          4.6,
          6,
          4,
          90,
          35,
          10,
          3.2,
          4.2
        ],
        [
          5.8,
          105,
          4.4,
          6,
          3.6,
          70,
          40,
          15,
          5.8,
          3.8
        ],
        [
          4.6,
          88,
          4.2,
          6,
          3.8,
          70,
          30,
          15,
          4.4,
          4.6
        ],
        [
          7.2,
          170,
          2.6,
          15,
          2.6,
          80,
          40,
          5,
          7,
          4.2
        ],
        [
          7.4,
          21,
          1.6,
          120,
          2.4,
          80,
          20,
          3,
          7.4,
          4.8
        ],
        [
          6,
          36,
          3.6,
          6,
          3.4,
          70,
          40,
          15,
          6,
          4.4
        ],
        [
          5,
          44,
          4.6,
          6,
          4,
          70,
          25,
          11,
          3.4,
          4.2
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A7",
          "score": 0.3238
        },
        {
          "alternative": "A8",
          "score": 0.2474
        },
        {
          "alternative": "A2",
          "score": 0.1435
        },
        {
          "alternative": "A1",
          "score": 0.1023
        },
        {
          "alternative": "A5",
          "score": -0.0056
        },
        {
          "alternative": "A9",
          "score": -0.0929
        },
        {
          "alternative": "A6",
          "score": -0.1269
        },
        {
          "alternative": "A10",
          "score": -0.1587
        },
        {
          "alternative": "A4",
          "score": -0.2599
        },
        {
          "alternative": "A3",
          "score": -0.4861
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.1023
        },
        {
          "alternative": "A2",
          "score": 0.1435
        },
        {
          "alternative": "A3",
          "score": -0.4861
        },
        {
          "alternative": "A4",
          "score": -0.2599
        },
        {
          "alternative": "A5",
          "score": -0.0056
        },
        {
          "alternative": "A6",
          "score": -0.1269
        },
        {
          "alternative": "A7",
          "score": 0.3238
        },
        {
          "alternative": "A8",
          "score": 0.2474
        },
        {
          "alternative": "A9",
          "score": -0.0929
        },
        {
          "alternative": "A10",
          "score": -0.1587
        }
      ],
      "tables": [
        {
          "id": "rawec-first-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.7838
            },
            {
              "row": 7,
              "column": 2,
              "value": 0.1235
            },
            {
              "row": 9,
              "column": 10,
              "value": 0.8095
            }
          ]
        },
        {
          "id": "rawec-second-normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.6207
            },
            {
              "row": 7,
              "column": 4,
              "value": 1
            },
            {
              "row": 9,
              "column": 9,
              "value": 0.9412
            }
          ]
        },
        {
          "id": "rawec-first-deviation",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0243
            },
            {
              "row": 0,
              "column": 4,
              "value": 0.0524
            },
            {
              "row": 6,
              "column": 2,
              "value": 0
            }
          ]
        },
        {
          "id": "rawec-index",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.3432
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.4215
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.3238
            }
          ]
        }
      ]
    },
    "tolerance": 0.0007
  },
  {
    "methodId": "regime",
    "variant": "crisp-weighted-pairwise-rmcda-example",
    "source": "RMCDA apply.REGIME official source implementation and worked example, RMCDA Software Impacts package paper, 2025, DOI: 10.1016/j.simpa.2025.100762",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/REGIME.R",
    "doi": "10.1016/j.simpa.2025.100762",
    "config": {
      "title": "REGIME external validation: weighted pairwise dominance example",
      "weightingId": "manual",
      "methodParams": {
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Benefit criterion",
          "direction": "benefit",
          "weight": 0.6
        },
        {
          "id": "C2",
          "name": "Cost criterion",
          "direction": "cost",
          "weight": 0.4
        }
      ],
      "values": [
        [
          10,
          5
        ],
        [
          12,
          4
        ],
        [
          11,
          6
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A2",
          "score": 1
        },
        {
          "alternative": "A3",
          "score": -0.4
        },
        {
          "alternative": "A1",
          "score": -0.6
        }
      ],
      "tables": [
        {
          "id": "regime-dominance",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": -1
            },
            {
              "row": 0,
              "column": 3,
              "value": -0.2
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.2
            }
          ]
        },
        {
          "id": "regime-flows",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0
            },
            {
              "row": 0,
              "column": 3,
              "value": -0.6
            },
            {
              "row": 1,
              "column": 1,
              "value": 1
            },
            {
              "row": 2,
              "column": 3,
              "value": -0.4
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "rim",
    "variant": "crisp-reference-ideal-index-rmcda-formula",
    "source": "RMCDA apply.RIM source implementation and documentation, built June 8 2025, citing RIM-reference ideal method in multicriteria decision making, Information Sciences, 2016, DOI: 10.1016/j.ins.2015.12.011",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/RIM.R",
    "doi": "10.1016/j.ins.2015.12.011",
    "config": {
      "title": "RIM validation: RMCDA reference-ideal formula audit case",
      "weightingId": "manual",
      "methodParams": {
        "rimReference": "Manual ideal interval",
        "rimDomainLower": "0,0,0",
        "rimDomainUpper": "10,10,10",
        "rimIdealLower": "8,0,4",
        "rimIdealUpper": "10,2,6",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Ideal profile"
        },
        {
          "id": "A2",
          "name": "Moderate profile"
        },
        {
          "id": "A3",
          "name": "Boundary profile"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Capability",
          "direction": "benefit",
          "weight": 0.5
        },
        {
          "id": "C2",
          "name": "Cost exposure",
          "direction": "cost",
          "weight": 0.3
        },
        {
          "id": "C3",
          "name": "Target fit",
          "direction": "benefit",
          "weight": 0.2
        }
      ],
      "values": [
        [
          10,
          0,
          5
        ],
        [
          5,
          5,
          8
        ],
        [
          0,
          10,
          10
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Ideal profile",
          "score": 1
        },
        {
          "alternative": "Moderate profile",
          "score": 0.6112
        },
        {
          "alternative": "Boundary profile",
          "score": 0
        }
      ],
      "tables": [
        {
          "id": "rim-closeness",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 1
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.625
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.5
            },
            {
              "row": 2,
              "column": 2,
              "value": 0
            }
          ]
        },
        {
          "id": "weighted-rim-closeness",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.5
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.1875
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.1
            }
          ]
        },
        {
          "id": "rim-distance-index",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.2404
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.3779
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.6112
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "rov",
    "variant": "crisp-linear-max-min-entropy-weights-fortune500",
    "source": "Selecting the Best Normalization Technique for ROV Method: Towards a Real Life Application, Gazi University Journal of Science, 2021, DOI: 10.35378/gujs.767525, Tables 4, 7-10",
    "sourceUrl": "https://doi.org/10.35378/gujs.767525",
    "doi": "10.35378/gujs.767525",
    "config": {
      "title": "ROV Fortune 500 financial performance validation",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "Walmart",
          "name": "Walmart"
        },
        {
          "id": "Amazon",
          "name": "Amazon.com"
        },
        {
          "id": "Exxon",
          "name": "Exxon Mobil"
        },
        {
          "id": "Apple",
          "name": "Apple"
        },
        {
          "id": "CVS",
          "name": "CVS Health"
        },
        {
          "id": "Berkshire",
          "name": "Berkshire Hathaway"
        },
        {
          "id": "Unitedhealth",
          "name": "Unitedhealth Group"
        },
        {
          "id": "McKesson",
          "name": "McKesson"
        },
        {
          "id": "ATT",
          "name": "AT&T"
        },
        {
          "id": "AmerisourceBergen",
          "name": "AmerisourceBergen"
        }
      ],
      "criteria": [
        {
          "id": "CR",
          "name": "Current ratio",
          "direction": "benefit",
          "weight": 0.085
        },
        {
          "id": "QR",
          "name": "Quick ratio",
          "direction": "benefit",
          "weight": 0.127
        },
        {
          "id": "ROE",
          "name": "Return on equity",
          "direction": "benefit",
          "weight": 0.224
        },
        {
          "id": "ROA",
          "name": "Return on assets",
          "direction": "benefit",
          "weight": 0.217
        },
        {
          "id": "ATR",
          "name": "Asset turnover rate",
          "direction": "benefit",
          "weight": 0.224
        },
        {
          "id": "LR",
          "name": "Leverage ratio",
          "direction": "cost",
          "weight": 0.015
        },
        {
          "id": "DTE",
          "name": "Debt to equity ratio",
          "direction": "cost",
          "weight": 0.107
        }
      ],
      "values": [
        [
          0.8,
          0.23,
          0.09,
          0.03,
          2.33,
          0.64,
          0.78
        ],
        [
          1.1,
          0.86,
          0.19,
          0.05,
          1.25,
          0.72,
          1.21
        ],
        [
          0.78,
          0.56,
          0.07,
          0.04,
          0.73,
          0.45,
          0.5
        ],
        [
          1.54,
          1.5,
          0.61,
          0.16,
          0.77,
          0.73,
          1.57
        ],
        [
          0.94,
          0.62,
          0.1,
          0.03,
          1.15,
          0.71,
          1.64
        ],
        [
          0.39,
          0.32,
          0.19,
          0.1,
          0.31,
          0.48,
          0.24
        ],
        [
          0.69,
          0.58,
          0.23,
          0.08,
          1.39,
          0.64,
          0.83
        ],
        [
          1.02,
          0.58,
          0.03,
          0.004,
          3.59,
          0.84,
          1.49
        ],
        [
          0.79,
          0.79,
          0.07,
          0.03,
          0.33,
          0.63,
          2.39
        ],
        [
          0.11,
          0.11,
          0.29,
          0.02,
          4.58,
          0.92,
          2.2
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Apple",
          "score": 0.362
        },
        {
          "alternative": "Unitedhealth Group",
          "score": 0.202
        },
        {
          "alternative": "Amazon.com",
          "score": 0.184
        },
        {
          "alternative": "AmerisourceBergen",
          "score": 0.178
        },
        {
          "alternative": "Berkshire Hathaway",
          "score": 0.176
        },
        {
          "alternative": "McKesson",
          "score": 0.158
        },
        {
          "alternative": "Walmart",
          "score": 0.153
        },
        {
          "alternative": "Exxon Mobil",
          "score": 0.139
        },
        {
          "alternative": "CVS Health",
          "score": 0.124
        },
        {
          "alternative": "AT&T",
          "score": 0.082
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.483
            },
            {
              "row": 0,
              "column": 6,
              "value": 0.596
            },
            {
              "row": 3,
              "column": 1,
              "value": 1
            },
            {
              "row": 9,
              "column": 5,
              "value": 1
            }
          ]
        },
        {
          "id": "rov-utilities",
          "cells": [
            {
              "row": 3,
              "column": 1,
              "value": 0.678
            },
            {
              "row": 3,
              "column": 2,
              "value": 0.047
            },
            {
              "row": 6,
              "column": 3,
              "value": 0.202
            },
            {
              "row": 8,
              "column": 3,
              "value": 0.082
            }
          ]
        }
      ]
    },
    "tolerance": 0.002
  },
  {
    "methodId": "saw",
    "variant": "crisp-linear-normalization-manual-weights",
    "source": "A Decision-Making Model Based on TOPSIS, WASPAS, and MULTIMOORA Methods for University Location Selection Problem, Sage Open, 2021, DOI: 10.1177/21582440211040115, Tables 5, 7, and 10",
    "sourceUrl": "https://journals.sagepub.com/doi/10.1177/21582440211040115",
    "doi": "10.1177/21582440211040115",
    "config": {
      "title": "SAW external validation: university location selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Mersin"
        },
        {
          "id": "A2",
          "name": "Adana"
        },
        {
          "id": "A3",
          "name": "Antalya"
        },
        {
          "id": "A4",
          "name": "Konya"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Population",
          "direction": "benefit",
          "weight": 0.13
        },
        {
          "id": "C2",
          "name": "Investment costs",
          "direction": "cost",
          "weight": 0.33
        },
        {
          "id": "C3",
          "name": "Number of universities",
          "direction": "cost",
          "weight": 0.27
        },
        {
          "id": "C4",
          "name": "Students attending high school",
          "direction": "benefit",
          "weight": 0.07
        },
        {
          "id": "C5",
          "name": "Yearly income per person",
          "direction": "benefit",
          "weight": 0.2
        }
      ],
      "values": [
        [
          1814.468,
          9,
          2.7,
          321.767,
          18.285
        ],
        [
          2220.125,
          6,
          4.3,
          410.691,
          15.521
        ],
        [
          2426.356,
          4,
          1.5,
          471.787,
          15.231
        ],
        [
          2205.609,
          4,
          2.7,
          345.159,
          11.637
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Antalya",
          "score": 0.9666
        },
        {
          "alternative": "Konya",
          "score": 0.7787
        },
        {
          "alternative": "Adana",
          "score": 0.665
        },
        {
          "alternative": "Mersin",
          "score": 0.64
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.7478
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.6667
            },
            {
              "row": 2,
              "column": 3,
              "value": 1
            },
            {
              "row": 3,
              "column": 5,
              "value": 0.6364
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0972
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.22
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.1666
            },
            {
              "row": 3,
              "column": 4,
              "value": 0.0512
            }
          ]
        }
      ]
    },
    "tolerance": 0.01
  },
  {
    "methodId": "smart",
    "variant": "crisp-positive-ratio-utility-manual-weights",
    "source": "Simple Multi-Attribute Rating Technique student-achievement worked example, Journal of Physics: Conference Series, 2017, DOI: 10.1088/1742-6596/930/1/012015, Tables 1-3",
    "sourceUrl": "https://iopscience.iop.org/article/10.1088/1742-6596/930/1/012015",
    "doi": "10.1088/1742-6596/930/1/012015",
    "config": {
      "title": "SMART external validation: student achievement selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear utility",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Criterion 1",
          "direction": "benefit",
          "weight": 0.4347826087
        },
        {
          "id": "C2",
          "name": "Criterion 2",
          "direction": "benefit",
          "weight": 0.347826087
        },
        {
          "id": "C3",
          "name": "Criterion 3",
          "direction": "benefit",
          "weight": 0.2173913043
        }
      ],
      "values": [
        [
          77,
          79,
          78
        ],
        [
          80,
          85,
          80
        ],
        [
          85,
          85,
          74
        ],
        [
          77,
          85,
          88
        ],
        [
          77,
          88,
          75
        ],
        [
          72,
          89,
          90
        ],
        [
          72,
          70,
          89
        ],
        [
          90,
          90,
          88
        ],
        [
          74,
          90,
          78
        ],
        [
          77,
          89,
          89
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A8",
          "score": 0.9952
        },
        {
          "alternative": "A10",
          "score": 0.9309
        },
        {
          "alternative": "A3",
          "score": 0.9179
        },
        {
          "alternative": "A4",
          "score": 0.913
        },
        {
          "alternative": "A6",
          "score": 0.9092
        },
        {
          "alternative": "A2",
          "score": 0.9082
        },
        {
          "alternative": "A9",
          "score": 0.8937
        },
        {
          "alternative": "A5",
          "score": 0.8932
        },
        {
          "alternative": "A1",
          "score": 0.8657
        },
        {
          "alternative": "A7",
          "score": 0.8333
        }
      ],
      "tables": [
        {
          "id": "utilities",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.8556
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.9444
            },
            {
              "row": 5,
              "column": 3,
              "value": 1
            },
            {
              "row": 7,
              "column": 2,
              "value": 1
            }
          ]
        },
        {
          "id": "weighted-utilities",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.372
            },
            {
              "row": 7,
              "column": 1,
              "value": 0.4348
            },
            {
              "row": 7,
              "column": 3,
              "value": 0.2126
            },
            {
              "row": 9,
              "column": 2,
              "value": 0.344
            }
          ]
        }
      ]
    },
    "tolerance": 0.0001
  },
  {
    "methodId": "smarter",
    "variant": "crisp-roc-utility-input-normalized-total",
    "source": "Multi-criteria clinical decision support: A primer on the use of multiple criteria decision making methods to promote evidence-based, patient-centered healthcare, Patient, 2011, DOI: 10.2165/11539470-000000000-00000, Table VI",
    "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3049911/",
    "doi": "10.2165/11539470-000000000-00000",
    "config": {
      "title": "SMARTER clinical decision-support validation",
      "weightingId": "manual",
      "methodParams": {
        "smarterOrder": "HaltProgression,SeriousAdverse,Cost,SymptomRelief,CommonAdverse",
        "smarterUtilityMode": "Input values are utilities",
        "smarterScoreMode": "Normalize total scores",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "DrugA",
          "name": "Drug A"
        },
        {
          "id": "DrugB1",
          "name": "Drug B1"
        },
        {
          "id": "DrugC",
          "name": "Drug C"
        }
      ],
      "criteria": [
        {
          "id": "SymptomRelief",
          "name": "Symptom relief",
          "direction": "benefit",
          "weight": 0.09
        },
        {
          "id": "HaltProgression",
          "name": "Halt disease progression",
          "direction": "benefit",
          "weight": 0.46
        },
        {
          "id": "SeriousAdverse",
          "name": "Serious adverse effects",
          "direction": "benefit",
          "weight": 0.26
        },
        {
          "id": "CommonAdverse",
          "name": "Common adverse effects",
          "direction": "benefit",
          "weight": 0.04
        },
        {
          "id": "Cost",
          "name": "Cost",
          "direction": "benefit",
          "weight": 0.16
        }
      ],
      "values": [
        [
          92,
          42,
          95,
          95,
          90
        ],
        [
          83,
          58,
          75,
          75,
          67
        ],
        [
          75,
          75,
          50,
          50,
          33
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Drug A",
          "score": 0.35
        },
        {
          "alternative": "Drug B1",
          "score": 0.34
        },
        {
          "alternative": "Drug C",
          "score": 0.31
        }
      ],
      "tables": [
        {
          "id": "smarter-rank-order",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": "HaltProgression"
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.4567
            },
            {
              "row": 4,
              "column": 1,
              "value": "CommonAdverse"
            },
            {
              "row": 4,
              "column": 3,
              "value": 0.04
            }
          ]
        },
        {
          "id": "smarter-weighted-utilities",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.082
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.1918
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.193
            },
            {
              "row": 2,
              "column": 5,
              "value": 0.052
            }
          ]
        }
      ]
    },
    "tolerance": 0.012
  },
  {
    "methodId": "spotis",
    "variant": "crisp-manual-bounds-original-rank-reversal-example",
    "source": "The SPOTIS Rank Reversal Free Method for Multi-Criteria Decision-Making Support, original numerical example, Tables/steps for normalized distance matrix and weighted distances",
    "sourceUrl": "https://www.researchgate.net/publication/344069742_The_SPOTIS_Rank_Reversal_Free_Method_for_Multi-Criteria_Decision-Making_Support",
    "doi": "10.1109/ACCESS.2020.3023519",
    "config": {
      "title": "SPOTIS validation: original rank-reversal example",
      "weightingId": "manual",
      "methodParams": {
        "spotisBounds": "Manual bounds",
        "spotisLowerBounds": "-5,-6,-8",
        "spotisUpperBounds": "12,10,5",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.2
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.3
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "benefit",
          "weight": 0.5
        }
      ],
      "values": [
        [
          10.5,
          -3.1,
          1.7
        ],
        [
          -4.7,
          0,
          3.4
        ],
        [
          8.1,
          0.3,
          1.3
        ],
        [
          3.2,
          7.3,
          -5.3
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A1",
          "score": 0.1989
        },
        {
          "alternative": "A3",
          "score": 0.3063
        },
        {
          "alternative": "A2",
          "score": 0.3707
        },
        {
          "alternative": "A4",
          "score": 0.7491
        }
      ],
      "scores": [
        {
          "alternative": "A1",
          "score": 0.1989
        },
        {
          "alternative": "A2",
          "score": 0.3707
        },
        {
          "alternative": "A3",
          "score": 0.3063
        },
        {
          "alternative": "A4",
          "score": 0.7491
        }
      ],
      "tables": [
        {
          "id": "spotis-bounds",
          "cells": [
            {
              "row": 0,
              "column": 4,
              "value": -5
            },
            {
              "row": 0,
              "column": 5,
              "value": 12
            },
            {
              "row": 1,
              "column": 6,
              "value": -6
            }
          ]
        },
        {
          "id": "normalized-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0882
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.1813
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.9824
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.7923
            }
          ]
        },
        {
          "id": "weighted-distance",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0176
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.1269
            },
            {
              "row": 3,
              "column": 2,
              "value": 0.2494
            }
          ]
        },
        {
          "id": "spotis-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1989
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.7491
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "sprobid",
    "variant": "crisp-vector-normalization-simplified-probid-pymcdm-example",
    "source": "pymcdm SPROBID implementation example, crawled 2026, citing Preference ranking on the basis of ideal-average distance method for multi-criteria decision-making, Industrial & Engineering Chemistry Research, 2021, DOI: 10.1021/acs.iecr.1c01453",
    "sourceUrl": "https://pymcdm.readthedocs.io/en/master/pymcdm.methods.html#pymcdm.methods.SPROBID",
    "doi": "10.1021/acs.iecr.1c01453",
    "config": {
      "title": "SPROBID validation: pymcdm implementation example",
      "weightingId": "manual",
      "methodParams": {
        "sprobidReference": "First/last-quarter ideal distance",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        },
        {
          "id": "A10",
          "name": "A10"
        },
        {
          "id": "A11",
          "name": "A11"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "C1",
          "direction": "benefit",
          "weight": 0.1819
        },
        {
          "id": "C2",
          "name": "C2",
          "direction": "cost",
          "weight": 0.2131
        },
        {
          "id": "C3",
          "name": "C3",
          "direction": "cost",
          "weight": 0.1838
        },
        {
          "id": "C4",
          "name": "C4",
          "direction": "cost",
          "weight": 0.1832
        },
        {
          "id": "C5",
          "name": "C5",
          "direction": "cost",
          "weight": 0.2379
        }
      ],
      "values": [
        [
          1679000,
          1.525e-7,
          0.00003747,
          0.251,
          2.917
        ],
        [
          2213000,
          1.304e-7,
          0.0000325,
          0.218,
          6.633
        ],
        [
          2461000,
          1.445e-7,
          0.00003854,
          0.259,
          0.553
        ],
        [
          2854000,
          1.54e-7,
          0.0000397,
          0.266,
          1.597
        ],
        [
          3107000,
          1.522e-7,
          0.00003779,
          0.254,
          2.905
        ],
        [
          3574000,
          1.469e-7,
          0.00003297,
          0.221,
          6.378
        ],
        [
          3932000,
          1.977e-7,
          0.00003129,
          0.21,
          11.381
        ],
        [
          4383000,
          1.292e-7,
          0.00003142,
          0.211,
          9.929
        ],
        [
          4988000,
          1.69e-7,
          0.00003767,
          0.253,
          8.459
        ],
        [
          5497000,
          5.703e-7,
          0.00003012,
          0.2,
          18.918
        ],
        [
          5751000,
          4.653e-7,
          0.00003017,
          0.201,
          17.517
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A5",
          "score": 3.4374
        },
        {
          "alternative": "A4",
          "score": 3.3702
        },
        {
          "alternative": "A3",
          "score": 3.2806
        },
        {
          "alternative": "A6",
          "score": 2.6435
        },
        {
          "alternative": "A1",
          "score": 2.4246
        },
        {
          "alternative": "A9",
          "score": 2.0885
        },
        {
          "alternative": "A2",
          "score": 2.0596
        },
        {
          "alternative": "A8",
          "score": 1.8158
        },
        {
          "alternative": "A7",
          "score": 1.2628
        },
        {
          "alternative": "A11",
          "score": 0.4279
        },
        {
          "alternative": "A10",
          "score": 0.3399
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.1299
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.0889
            },
            {
              "row": 9,
              "column": 2,
              "value": 0.656
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0236
            },
            {
              "row": 4,
              "column": 5,
              "value": 0.0211
            },
            {
              "row": 9,
              "column": 2,
              "value": 0.1398
            }
          ]
        },
        {
          "id": "sprobid-distances",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0911
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.2208
            },
            {
              "row": 0,
              "column": 3,
              "value": 2.4246
            },
            {
              "row": 4,
              "column": 3,
              "value": 3.4374
            },
            {
              "row": 9,
              "column": 3,
              "value": 0.3399
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "srp",
    "variant": "crisp-dense-rank-vimm-weights-material-selection",
    "source": "A decision analysis model for material selection using simple ranking process, Scientific Reports, 2023, DOI: 10.1038/s41598-023-35405-z, Tables 20-24",
    "sourceUrl": "https://www.nature.com/articles/s41598-023-35405-z",
    "doi": "10.1038/s41598-023-35405-z",
    "config": {
      "title": "SRP external validation: material selection with VIMM weights",
      "weightingId": "manual",
      "methodParams": {
        "srpRankMode": "Criterion-wise rank aggregation",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "A1"
        },
        {
          "id": "A2",
          "name": "A2"
        },
        {
          "id": "A3",
          "name": "A3"
        },
        {
          "id": "A4",
          "name": "A4"
        },
        {
          "id": "A5",
          "name": "A5"
        },
        {
          "id": "A6",
          "name": "A6"
        },
        {
          "id": "A7",
          "name": "A7"
        },
        {
          "id": "A8",
          "name": "A8"
        },
        {
          "id": "A9",
          "name": "A9"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Tensile strength",
          "direction": "benefit",
          "weight": 0.348
        },
        {
          "id": "C2",
          "name": "Tensile modulus",
          "direction": "benefit",
          "weight": 0.218
        },
        {
          "id": "C3",
          "name": "Flexural strength",
          "direction": "benefit",
          "weight": 0.057
        },
        {
          "id": "C4",
          "name": "Flexural modulus",
          "direction": "benefit",
          "weight": 0.05
        },
        {
          "id": "C5",
          "name": "Impact strength",
          "direction": "benefit",
          "weight": 0.304
        },
        {
          "id": "C6",
          "name": "Erosion rate",
          "direction": "cost",
          "weight": 0.023
        }
      ],
      "values": [
        [
          169.98,
          1560,
          1.46,
          2.13,
          1.09,
          0.255
        ],
        [
          186.5,
          903,
          2.83,
          2.38,
          0.18,
          0.745
        ],
        [
          190,
          830,
          2.1,
          2.1,
          0.21,
          0.335
        ],
        [
          214.4,
          850,
          0.9,
          0.9,
          0.2,
          0.255
        ],
        [
          206,
          789,
          1.8,
          2.4,
          0.18,
          0.335
        ],
        [
          194.6,
          785,
          1.93,
          2.38,
          0.22,
          0.335
        ],
        [
          245,
          773.22,
          0.3767,
          2.267,
          0.14,
          0.335
        ],
        [
          222,
          775.8,
          1.7189,
          1.921,
          0.142,
          0.665
        ],
        [
          247,
          776.33,
          0.7467,
          2.377,
          0.138,
          0.335
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "A4",
          "score": 4.916
        },
        {
          "alternative": "A1",
          "score": 4.731
        },
        {
          "alternative": "A6",
          "score": 4.679
        },
        {
          "alternative": "A5",
          "score": 4.326
        },
        {
          "alternative": "A3",
          "score": 4.32
        },
        {
          "alternative": "A9",
          "score": 4.042
        },
        {
          "alternative": "A2",
          "score": 4.011
        },
        {
          "alternative": "A8",
          "score": 3.684
        },
        {
          "alternative": "A7",
          "score": 3.455
        }
      ],
      "tables": [
        {
          "id": "srp-rank-matrix",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 9
            },
            {
              "row": 0,
              "column": 4,
              "value": 5
            },
            {
              "row": 5,
              "column": 4,
              "value": 2
            },
            {
              "row": 8,
              "column": 6,
              "value": 2
            }
          ]
        },
        {
          "id": "srp-weighted-rank-matrix",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 3.132
            },
            {
              "row": 3,
              "column": 5,
              "value": 1.216
            },
            {
              "row": 8,
              "column": 6,
              "value": 0.046
            }
          ]
        },
        {
          "id": "srp-final-score",
          "cells": [
            {
              "row": 3,
              "column": 1,
              "value": 4.084
            },
            {
              "row": 3,
              "column": 2,
              "value": 4.916
            },
            {
              "row": 6,
              "column": 2,
              "value": 3.455
            }
          ]
        }
      ]
    },
    "tolerance": 0.0005
  },
  {
    "methodId": "todim",
    "variant": "crisp-material-selection-rmcda-example-theta-1",
    "source": "RMCDA apply.TODIM official source implementation and material-selection worked example, RMCDA Software Impacts package paper, 2025, DOI: 10.1016/j.simpa.2025.100762",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/TODIM.R",
    "doi": "10.1016/j.simpa.2025.100762",
    "config": {
      "title": "TODIM external validation: material selection with theta 1",
      "weightingId": "manual",
      "methodParams": {
        "todimTheta": 1,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "AI 2024-T6"
        },
        {
          "id": "A2",
          "name": "AI 5052-O"
        },
        {
          "id": "A3",
          "name": "SS 301 FH"
        },
        {
          "id": "A4",
          "name": "SS 310-3AH"
        },
        {
          "id": "A5",
          "name": "Ti-6AI-4V"
        },
        {
          "id": "A6",
          "name": "Inconel 718"
        },
        {
          "id": "A7",
          "name": "70Cu-30Zn"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Toughness Index",
          "direction": "benefit",
          "weight": 0.28
        },
        {
          "id": "C2",
          "name": "Yield Strength",
          "direction": "benefit",
          "weight": 0.14
        },
        {
          "id": "C3",
          "name": "Young's Modulus",
          "direction": "benefit",
          "weight": 0.05
        },
        {
          "id": "C4",
          "name": "Density",
          "direction": "cost",
          "weight": 0.24
        },
        {
          "id": "C5",
          "name": "Thermal Expansion",
          "direction": "cost",
          "weight": 0.19
        },
        {
          "id": "C6",
          "name": "Thermal Conductivity",
          "direction": "cost",
          "weight": 0.05
        },
        {
          "id": "C7",
          "name": "Specific Heat",
          "direction": "cost",
          "weight": 0.05
        }
      ],
      "values": [
        [
          75.5,
          420,
          74.2,
          2.8,
          21.4,
          0.37,
          0.16
        ],
        [
          95,
          91,
          70,
          2.68,
          22.1,
          0.33,
          0.16
        ],
        [
          770,
          1365,
          189,
          7.9,
          16.9,
          0.04,
          0.08
        ],
        [
          187,
          1120,
          210,
          7.9,
          14.4,
          0.03,
          0.08
        ],
        [
          179,
          875,
          112,
          4.43,
          9.4,
          0.016,
          0.09
        ],
        [
          239,
          1190,
          217,
          8.51,
          11.5,
          0.31,
          0.07
        ],
        [
          237,
          200,
          112,
          8.53,
          19.9,
          0.29,
          0.06
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "SS 301 FH",
          "score": 1
        },
        {
          "alternative": "SS 310-3AH",
          "score": 0.974
        },
        {
          "alternative": "Inconel 718",
          "score": 0.9383
        },
        {
          "alternative": "Ti-6AI-4V",
          "score": 0.8586
        },
        {
          "alternative": "70Cu-30Zn",
          "score": 0.4696
        },
        {
          "alternative": "AI 2024-T6",
          "score": 0.078
        },
        {
          "alternative": "AI 5052-O",
          "score": 0
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0981
            },
            {
              "row": 2,
              "column": 2,
              "value": 1
            },
            {
              "row": 6,
              "column": 7,
              "value": 1
            }
          ]
        },
        {
          "id": "todim-dominance-matrix",
          "cells": [
            {
              "row": 0,
              "column": 2,
              "value": -0.7809
            },
            {
              "row": 2,
              "column": 4,
              "value": -3.1182
            },
            {
              "row": 5,
              "column": 3,
              "value": -5.108
            }
          ]
        },
        {
          "id": "todim-dominance-score",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": -56.5649
            },
            {
              "row": 2,
              "column": 2,
              "value": 1
            },
            {
              "row": 6,
              "column": 2,
              "value": 0.4696
            }
          ]
        }
      ]
    },
    "tolerance": 0.0006
  },
  {
    "methodId": "topsis",
    "variant": "crisp-vector-normalization-ahp-weights-hospital-supplier",
    "source": "Integrated Multicriteria Decision-Making Methods to Solve Supplier Selection Problem: A Case Study in a Hospital, Journal of Healthcare Engineering, 2019, DOI: 10.1155/2019/5614892, Tables 3-4",
    "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6811789/",
    "doi": "10.1155/2019/5614892",
    "config": {
      "title": "TOPSIS hospital supplier-selection validation",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Vector normalization",
        "distanceMetric": "Euclidean",
        "idealSolution": "Benefit/cost aware",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "S1",
          "name": "Supplier1"
        },
        {
          "id": "S2",
          "name": "Supplier2"
        },
        {
          "id": "S3",
          "name": "Supplier3"
        }
      ],
      "criteria": [
        {
          "id": "Logistics",
          "name": "Logistics",
          "direction": "benefit",
          "weight": 0.513
        },
        {
          "id": "Quality",
          "name": "Quality",
          "direction": "benefit",
          "weight": 0.129
        },
        {
          "id": "Cost",
          "name": "Cost",
          "direction": "cost",
          "weight": 0.262
        },
        {
          "id": "Flexibility",
          "name": "Flexibility",
          "direction": "benefit",
          "weight": 0.063
        },
        {
          "id": "Reliability",
          "name": "Reliability",
          "direction": "benefit",
          "weight": 0.033
        }
      ],
      "values": [
        [
          0.731,
          0.292,
          0.193,
          0.64,
          0.086
        ],
        [
          0.188,
          0.079,
          0.203,
          0.183,
          0.314
        ],
        [
          0.081,
          0.629,
          0.605,
          0.177,
          0.6
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Supplier1",
          "score": 0.876
        },
        {
          "alternative": "Supplier2",
          "score": 0.312
        },
        {
          "alternative": "Supplier3",
          "score": 0.182
        }
      ],
      "tables": [
        {
          "id": "topsis-distances",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.067
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.472
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.383
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.105
            }
          ]
        },
        {
          "id": "ideal",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.494
            },
            {
              "row": 0,
              "column": 3,
              "value": 0.0758
            },
            {
              "row": 1,
              "column": 3,
              "value": 0.2378
            }
          ]
        }
      ]
    },
    "tolerance": 0.001
  },
  {
    "methodId": "vikor",
    "variant": "crisp-manual-critic-weights-v-0.5",
    "source": "Comprehensive power quality performance assessment for electrical system of a nuclear research reactor, Scientific Reports, 2023, DOI: 10.1038/s41598-023-36692-2, Tables 2, 5, 7, and 8",
    "sourceUrl": "https://pmc.ncbi.nlm.nih.gov/articles/PMC10279760/",
    "doi": "10.1038/s41598-023-36692-2",
    "config": {
      "title": "VIKOR external validation: nuclear reactor power quality assessment",
      "weightingId": "manual",
      "methodParams": {
        "vikorV": 0.5,
        "vikorAcceptableAdvantageMode": "Auto DQ = 1/(m-1)",
        "vikorStabilityRule": "Q winner must also lead S or R",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "S1",
          "name": "Sample 1"
        },
        {
          "id": "S2",
          "name": "Sample 2"
        },
        {
          "id": "S3",
          "name": "Sample 3"
        },
        {
          "id": "S4",
          "name": "Sample 4"
        },
        {
          "id": "S5",
          "name": "Sample 5"
        },
        {
          "id": "S6",
          "name": "Sample 6"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "F_dev",
          "direction": "cost",
          "weight": 0.124
        },
        {
          "id": "C2",
          "name": "V_Un",
          "direction": "cost",
          "weight": 0.1642
        },
        {
          "id": "C3",
          "name": "I_Un",
          "direction": "cost",
          "weight": 0.1252
        },
        {
          "id": "C4",
          "name": "Pst",
          "direction": "cost",
          "weight": 0.1287
        },
        {
          "id": "C5",
          "name": "Plt",
          "direction": "cost",
          "weight": 0.1143
        },
        {
          "id": "C6",
          "name": "VTHD",
          "direction": "cost",
          "weight": 0.1108
        },
        {
          "id": "C7",
          "name": "ITHD",
          "direction": "cost",
          "weight": 0.1223
        },
        {
          "id": "C8",
          "name": "PF",
          "direction": "benefit",
          "weight": 0.1104
        }
      ],
      "values": [
        [
          0.14508,
          0.0935,
          3.2588,
          0.105193333,
          0.085046667,
          0.844866667,
          5.8457,
          0.9684
        ],
        [
          0.25958,
          0.065,
          4.2029,
          0.105323333,
          0.109903333,
          0.965,
          8.030833333,
          0.9747
        ],
        [
          0.15946,
          0.0323,
          3.1262,
          0.126253333,
          0.158126667,
          0.967466667,
          7.130566667,
          0.964
        ],
        [
          0.18056,
          0.0708,
          2.8682,
          0.106096667,
          0.142603333,
          1.2088,
          6.127033333,
          0.9661
        ],
        [
          0.31088,
          0.0739,
          3.6941,
          0.097556667,
          0.10393,
          0.908266667,
          6.840866667,
          0.9648
        ],
        [
          0.26864,
          0.0323,
          2.0803,
          0.13881,
          0.20178,
          0.9539,
          5.280833333,
          0.9523
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Sample 3",
          "score": 0.239469579
        },
        {
          "alternative": "Sample 4",
          "score": 0.497224467
        },
        {
          "alternative": "Sample 1",
          "score": 0.5
        },
        {
          "alternative": "Sample 5",
          "score": 0.680741687
        },
        {
          "alternative": "Sample 6",
          "score": 0.691920046
        },
        {
          "alternative": "Sample 2",
          "score": 0.738955823
        }
      ],
      "tables": [
        {
          "id": "vikor",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.3138
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.1252
            },
            {
              "row": 2,
              "column": 3,
              "value": 0.239469579
            },
            {
              "row": 3,
              "column": 3,
              "value": 0.497224467
            },
            {
              "row": 5,
              "column": 1,
              "value": 0.479
            }
          ]
        },
        {
          "id": "vikor-acceptable-solution",
          "cells": [
            {
              "row": 0,
              "column": 3,
              "value": "Accepted"
            },
            {
              "row": 1,
              "column": 3,
              "value": "Accepted"
            }
          ]
        }
      ],
      "diagnostics": [
        {
          "label": "VIKOR acceptable advantage",
          "status": "pass"
        },
        {
          "label": "VIKOR acceptable stability",
          "status": "pass"
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "waspas",
    "variant": "crisp-linear-normalization-manual-weights-alpha-0.5",
    "source": "A Decision-Making Model Based on TOPSIS, WASPAS, and MULTIMOORA Methods for University Location Selection Problem, Sage Open, 2021, DOI: 10.1177/21582440211040115, Tables 5, 7, 10, and 11",
    "sourceUrl": "https://journals.sagepub.com/doi/10.1177/21582440211040115",
    "doi": "10.1177/21582440211040115",
    "config": {
      "title": "WASPAS external validation: university location selection",
      "weightingId": "manual",
      "methodParams": {
        "waspasLambda": 0.5,
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Mersin"
        },
        {
          "id": "A2",
          "name": "Adana"
        },
        {
          "id": "A3",
          "name": "Antalya"
        },
        {
          "id": "A4",
          "name": "Konya"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Population",
          "direction": "benefit",
          "weight": 0.13
        },
        {
          "id": "C2",
          "name": "Investment costs",
          "direction": "cost",
          "weight": 0.33
        },
        {
          "id": "C3",
          "name": "Number of universities",
          "direction": "cost",
          "weight": 0.27
        },
        {
          "id": "C4",
          "name": "Students attending high school",
          "direction": "benefit",
          "weight": 0.07
        },
        {
          "id": "C5",
          "name": "Yearly income per person",
          "direction": "benefit",
          "weight": 0.2
        }
      ],
      "values": [
        [
          1814.468,
          9,
          2.7,
          321.767,
          18.285
        ],
        [
          2220.125,
          6,
          4.3,
          410.691,
          15.521
        ],
        [
          2426.356,
          4,
          1.5,
          471.787,
          15.231
        ],
        [
          2205.609,
          4,
          2.7,
          345.159,
          11.637
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Antalya",
          "score": 0.9654
        },
        {
          "alternative": "Konya",
          "score": 0.767
        },
        {
          "alternative": "Adana",
          "score": 0.645
        },
        {
          "alternative": "Mersin",
          "score": 0.6266
        }
      ],
      "tables": [
        {
          "id": "waspas",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.64
            },
            {
              "row": 0,
              "column": 2,
              "value": 0.61
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.665
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.63
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.9666
            },
            {
              "row": 2,
              "column": 2,
              "value": 0.96
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.7787
            },
            {
              "row": 3,
              "column": 2,
              "value": 0.76
            }
          ]
        }
      ]
    },
    "tolerance": 0.01
  },
  {
    "methodId": "wisp",
    "variant": "crisp-max-normalization-rmcda-material-selection",
    "source": "RMCDA apply.WISP official worked example and source implementation, built June 8 2025, citing An Integrated Simple Weighted Sum Product Method-WISP, IEEE Transactions on Engineering Management, DOI: 10.1109/TEM.2021.3075783",
    "sourceUrl": "https://rdrr.io/cran/RMCDA/src/R/WISP.R",
    "doi": "10.1109/TEM.2021.3075783",
    "config": {
      "title": "WISP validation: RMCDA material selection example",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Max normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "AI 2024-T6"
        },
        {
          "id": "A2",
          "name": "AI 5052-O"
        },
        {
          "id": "A3",
          "name": "SS 301 FH"
        },
        {
          "id": "A4",
          "name": "SS 310-3AH"
        },
        {
          "id": "A5",
          "name": "Ti-6AI-4V"
        },
        {
          "id": "A6",
          "name": "Inconel 718"
        },
        {
          "id": "A7",
          "name": "70Cu-30Zn"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Toughness Index",
          "direction": "benefit",
          "weight": 0.28
        },
        {
          "id": "C2",
          "name": "Yield Strength",
          "direction": "benefit",
          "weight": 0.14
        },
        {
          "id": "C3",
          "name": "Young's Modulus",
          "direction": "cost",
          "weight": 0.05
        },
        {
          "id": "C4",
          "name": "Density",
          "direction": "benefit",
          "weight": 0.24
        },
        {
          "id": "C5",
          "name": "Thermal Expansion",
          "direction": "cost",
          "weight": 0.19
        },
        {
          "id": "C6",
          "name": "Thermal Conductivity",
          "direction": "cost",
          "weight": 0.05
        },
        {
          "id": "C7",
          "name": "Specific Heat",
          "direction": "cost",
          "weight": 0.05
        }
      ],
      "values": [
        [
          75.5,
          420,
          74.2,
          2.8,
          21.4,
          0.37,
          0.16
        ],
        [
          95,
          91,
          70,
          2.68,
          22.1,
          0.33,
          0.16
        ],
        [
          770,
          1365,
          189,
          7.9,
          16.9,
          0.04,
          0.08
        ],
        [
          187,
          1120,
          210,
          7.9,
          14.4,
          0.03,
          0.08
        ],
        [
          179,
          875,
          112,
          4.43,
          9.4,
          0.016,
          0.09
        ],
        [
          239,
          1190,
          217,
          8.51,
          11.5,
          0.31,
          0.07
        ],
        [
          237,
          200,
          112,
          8.53,
          19.9,
          0.29,
          0.06
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "SS 301 FH",
          "score": 1
        },
        {
          "alternative": "Ti-6AI-4V",
          "score": 0.7831
        },
        {
          "alternative": "SS 310-3AH",
          "score": 0.7217
        },
        {
          "alternative": "Inconel 718",
          "score": 0.6771
        },
        {
          "alternative": "70Cu-30Zn",
          "score": 0.5932
        },
        {
          "alternative": "AI 2024-T6",
          "score": 0.4924
        },
        {
          "alternative": "AI 5052-O",
          "score": 0.4806
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0981
            },
            {
              "row": 1,
              "column": 5,
              "value": 1
            },
            {
              "row": 2,
              "column": 1,
              "value": 1
            }
          ]
        },
        {
          "id": "weighted",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.0275
            },
            {
              "row": 2,
              "column": 4,
              "value": 0.2223
            },
            {
              "row": 6,
              "column": 7,
              "value": 0.0188
            }
          ]
        },
        {
          "id": "wisp-components",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": -0.1518
            },
            {
              "row": 2,
              "column": 3,
              "value": 2.9294
            },
            {
              "row": 2,
              "column": 9,
              "value": 1
            },
            {
              "row": 5,
              "column": 9,
              "value": 0.6771
            }
          ]
        }
      ]
    },
    "tolerance": 0.0002
  },
  {
    "methodId": "wpm",
    "variant": "crisp-linear-normalization-manual-weights",
    "source": "A Decision-Making Model Based on TOPSIS, WASPAS, and MULTIMOORA Methods for University Location Selection Problem, Sage Open, 2021, DOI: 10.1177/21582440211040115, Tables 5, 7, and 10",
    "sourceUrl": "https://journals.sagepub.com/doi/10.1177/21582440211040115",
    "doi": "10.1177/21582440211040115",
    "config": {
      "title": "WPM external validation: university location selection",
      "weightingId": "manual",
      "methodParams": {
        "normalization": "Linear normalization",
        "dataInputMode": "Single aggregated dataset",
        "fuzzyInputMode": "Defuzzify on upload"
      }
    },
    "input": {
      "alternatives": [
        {
          "id": "A1",
          "name": "Mersin"
        },
        {
          "id": "A2",
          "name": "Adana"
        },
        {
          "id": "A3",
          "name": "Antalya"
        },
        {
          "id": "A4",
          "name": "Konya"
        }
      ],
      "criteria": [
        {
          "id": "C1",
          "name": "Population",
          "direction": "benefit",
          "weight": 0.13
        },
        {
          "id": "C2",
          "name": "Investment costs",
          "direction": "cost",
          "weight": 0.33
        },
        {
          "id": "C3",
          "name": "Number of universities",
          "direction": "cost",
          "weight": 0.27
        },
        {
          "id": "C4",
          "name": "Students attending high school",
          "direction": "benefit",
          "weight": 0.07
        },
        {
          "id": "C5",
          "name": "Yearly income per person",
          "direction": "benefit",
          "weight": 0.2
        }
      ],
      "values": [
        [
          1814.468,
          9,
          2.7,
          321.767,
          18.285
        ],
        [
          2220.125,
          6,
          4.3,
          410.691,
          15.521
        ],
        [
          2426.356,
          4,
          1.5,
          471.787,
          15.231
        ],
        [
          2205.609,
          4,
          2.7,
          345.159,
          11.637
        ]
      ]
    },
    "expected": {
      "ranking": [
        {
          "alternative": "Antalya",
          "score": 0.96
        },
        {
          "alternative": "Konya",
          "score": 0.76
        },
        {
          "alternative": "Adana",
          "score": 0.63
        },
        {
          "alternative": "Mersin",
          "score": 0.61
        }
      ],
      "tables": [
        {
          "id": "normalized",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.7478
            },
            {
              "row": 1,
              "column": 2,
              "value": 0.6667
            },
            {
              "row": 2,
              "column": 3,
              "value": 1
            },
            {
              "row": 3,
              "column": 5,
              "value": 0.6364
            }
          ]
        },
        {
          "id": "wpm-utility",
          "cells": [
            {
              "row": 0,
              "column": 1,
              "value": 0.61
            },
            {
              "row": 1,
              "column": 1,
              "value": 0.63
            },
            {
              "row": 2,
              "column": 1,
              "value": 0.96
            },
            {
              "row": 3,
              "column": 1,
              "value": 0.76
            }
          ]
        }
      ]
    },
    "tolerance": 0.01
  }
] as ExternalFixtureSample[];

export function externalFixtureSampleFor(methodId: MethodId) {
  return externalFixtureSamples.find((fixture) => fixture.methodId === methodId);
}
