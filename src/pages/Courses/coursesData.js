export const CATEGORIES = [
  { key: 'honors', label: 'Honors' },
  { key: 'compsci', label: 'CS' },
  { key: 'maths', label: 'Maths' },
  { key: 'physics', label: 'Physics' },
  { key: 'electives', label: 'Electives' },
  { key: 'teaching', label: 'Teaching' },
];

export const SCHOOLS = [
  {
    name: 'College of San Mateo',
    semesters: [
      {
        name: 'Spring 2022',
        courses: [
          { code: 'MATH 251', hover: 'Calculus with Analytic Geometry I', category: 'maths' },
          { code: 'PSYC 100', hover: 'General Psychology', category: 'electives' },
          { code: 'ARCH 100', hover: 'Survey of Modern Architecture', category: 'electives' },
          { code: 'ENGL 100', hover: 'Composition and Reading', category: 'electives' },
        ],
      },
      {
        name: 'Summer 2022',
        courses: [{ code: 'ART 104', hover: 'Art of Renaissance & Baroque', category: 'electives' }],
      },
      {
        name: 'Fall 2022',
        courses: [
          { code: 'IDST 102', hover: 'Sciences Honors Seminar I', category: 'honors' },
          { code: 'HIST 100', hover: 'History Western Civilization I', category: 'electives' },
          { code: 'ARCH 120', hover: 'Arch+Design Draw 1: Draw & Visual', category: 'electives' },
          { code: 'BIOL 110', hover: 'General Principles of Biology', category: 'electives' },
          { code: 'ARCH 666', hover: 'Intro To Architecture', category: 'electives' },
          { code: 'ENGL 110', hover: 'Composition, Literature, and Critical Thinking', category: 'electives' },
          { code: 'LCTR 100', hover: 'Effective Tutoring', category: 'electives' },
        ],
      },
      {
        name: 'Spring 2023',
        courses: [
          { code: 'IDST 104', hover: 'Sciences Honors Seminar II', category: 'honors' },
          { code: 'CIS 254', hover: 'Introduction to Object-Oriented Program Design', category: 'compsci' },
          { code: 'MATH 252', hover: 'Calculus with Analytic Geometry II', category: 'maths' },
          { code: 'MATH 268', hover: 'Discrete Mathematics', category: 'maths' },
          { code: 'PHYS 250', hover: 'Physics with Calculus I', category: 'physics' },
        ],
      },
      {
        name: 'Summer 2023',
        courses: [
          { code: 'CIS 278', hover: 'Programming Methods: C++', category: 'compsci' },
          { code: 'MATH 253', hover: 'Calculus with Analytic Geometry III', category: 'maths' },
        ],
      },
      {
        name: 'Fall 2023',
        courses: [
          { code: 'CIS 117', hover: 'Python Programming', category: 'compsci' },
          { code: 'CIS 264', hover: 'Computer Organization and Systems Programming', category: 'compsci' },
          { code: 'MATH 275', hover: 'Ordinary Differential Equations', category: 'maths' },
          { code: 'PHYS 260', hover: 'Physics with Calculus II', category: 'physics' },
          { code: 'HIST 420', hover: 'Survey of Latin American History', category: 'electives' },
          {
            code: 'ETHN 101',
            hover: 'Latin American and Indigenous Peoples History and Culture',
            category: 'electives',
          },
          { code: 'MATH 251', hover: 'Calculus with Analytic Geometry I', category: 'teaching' },
          { code: 'MATH 130', hover: 'Analytical Trigonometry', category: 'teaching' },
        ],
      },
      {
        name: 'Spring 2024',
        courses: [
          { code: 'CIS 279', hover: 'Data Structures: C++', category: 'compsci' },
          { code: 'CIS 502', hover: 'Applied Python Programming', category: 'compsci' },
          { code: 'MATH 270', hover: 'Linear Algebra', category: 'maths' },
          { code: 'PHYS 270', hover: 'Physics with Calculus III', category: 'physics' },
          { code: 'COMM 110', hover: 'Public Speaking', category: 'electives' },
          { code: 'MATH 253', hover: 'Calculus with Analytic Geometry III', category: 'teaching' },
          { code: 'MATH 268', hover: 'Discrete Mathematics', category: 'teaching' },
        ],
      },
    ],
  },
  {
    name: 'UC Berkeley',
    semesters: [
      {
        name: 'Fall 2024',
        courses: [
          { code: 'CS 70', hover: 'Discrete Mathematics and Probability Theory', category: 'compsci' },
          { code: 'CS 61B', hover: 'Data Structures', category: 'compsci' },
          { code: 'STAT 20', hover: 'Introduction to Probability and Statistics', category: 'maths' },
          { code: 'DATA C104', hover: 'Human Contexts and Ethics of Data', category: 'electives' },
        ],
      },
      {
        name: 'Spring 2025',
        courses: [
          { code: 'CS 170', hover: 'Efficient Algorithms and Intractable Problems', category: 'compsci' },
          { code: 'CS 161', hover: 'Computer Security', category: 'compsci' },
          { code: 'CS 162', hover: 'Operating Systems and System Programming', category: 'compsci' },
          { code: 'CS 47A', hover: 'Completion of Work in Computer Science 61A', category: 'compsci' },
        ],
      },
      {
        name: 'Summer 2025',
        courses: [
          { code: 'HIST 137AC', hover: 'Immigrants and Immigration as U.S. History', category: 'electives' },
          { code: 'CS 161', hover: 'Computer Security', category: 'teaching' },
        ],
      },
      {
        name: 'Fall 2025',
        courses: [
          { code: 'DATA 100', hover: 'Principles and Techniques of Data Science', category: 'compsci' },
          { code: 'EECS 127', hover: 'Optimization Models in Engineering', category: 'compsci' },
          { code: 'CS 188', hover: 'Introduction to Artificial Intelligence', category: 'compsci' },
        ],
      },
      {
        name: 'Spring 2026',
        courses: [
          { code: 'CS 186', hover: 'Introduction to Database Systems', category: 'compsci' },
          { code: 'CS 189', hover: 'Intro to Machine Learning', category: 'compsci' },
          { code: 'JAPAN 1A', hover: 'Elementary Japanese', category: 'electives' },
          { code: 'CS 161', hover: 'Computer Security', category: 'teaching' },
        ],
      },
    ],
  },
];
