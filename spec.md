# Technical Specification: Smart Planner (Neuroengineering Transition)

## Project Overview
The Smart Planner is a specialized task management and scheduling application designed to facilitate a career transition from Software Engineering to Neuroengineering. It uses a structured 5-step competency process (Explore, Learn, Build, Integrate, Reflect) to guide the user's progress and manages time based on category-specific allotments.

## Features
- **Task Management**: Create, read, update, and delete tasks.
    - Fields: Name, Description, Priority (High, Medium, Low), Category, Estimated Duration.
- **Missions**: Logical groupings of tasks representing larger objectives or projects.
- **5-Step Competency Categories**:
    - **Explore**: Broad research and discovery.
    - **Learn**: Deep dives and formal study.
    - **Build**: Hands-on project work.
    - **Integrate**: Combining new knowledge with existing engineering skills.
    - **Reflect**: Reviewing progress and adjusting course.
    - **Office Hours**: Dedicated time for administrative tasks or meetings.
    - **Other**: Miscellaneous tasks.
- **AI-Powered Assistance**:
    - **Estimation**: Suggest task durations based on description.
    - **Sub-task Generation**: Break down complex tasks into manageable steps.
- **Daily Schedule Generator**:
    - Generates a calendar-style table in 15-minute increments.
    - Prioritizes tasks within their category capacity.
    - Balances time across categories defined by the user.

## Tech Stack
- **Frontend**: Vanilla HTML5, CSS3 (using Glassmorphism design provided by UX), and JavaScript (ES6+).
- **Storage**: Browser LocalStorage for persistence (MVP phase).
- **AI Integration**: (Simulated or via Lightweight API) for task breakdown and estimation logic.

## Data Model

### Task
```json
{
  "id": "uuid",
  "missionId": "uuid",
  "name": "string",
  "description": "string",
  "priority": "high | medium | low",
  "category": "explore | learn | build | integrate | reflect | office-hours | other",
  "estimatedMinutes": 0,
  "completed": false,
  "subtasks": [
    { "id": "uuid", "name": "string", "completed": false }
  ]
}
```

### Mission
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string"
}
```

### Daily Configuration (Time Allotment)
```json
{
  "allotments": {
    "explore": 60,
    "learn": 120,
    "build": 180,
    "integrate": 60,
    "reflect": 30,
    "office-hours": 60,
    "other": 60
  }
}
```

## File Structure
- `index.html`: Main application entry point.
- `style.css`: Visual styling and layout (provided by UX).
- `app.js`: Main application logic, state management, and DOM manipulation.
- `scheduler.js`: Logic for generating the 15-minute increment schedule.
- `ai-helper.js`: Simulated AI logic for task breakdown and estimation.
- `storage.js`: CRUD wrappers for LocalStorage.

## Scheduling Logic
1. **Filter**: Identify all uncompleted tasks.
2. **Group**: Group tasks by category.
3. **Sort**: Sort tasks within categories by priority (High > Medium > Low).
4. **Allot**: Assign time slots based on the category's daily allotment and the task's estimate.
5. **Generate**: Fill the 15-minute increment table. If a task exceeds the allotment for the day, it is carried over to the next day's "potential" list.

## Testing Criteria
- Tasks can be created with all required fields.
- Tasks can be assigned to Missions.
- The schedule table correctly displays 15-minute increments.
- Total time scheduled for a category does not exceed its daily allotment.
- Data persists across page refreshes.
- Sub-tasks can be toggled as completed.

## Edge Cases
- **Overfilled Allotment**: If a single task is longer than the daily allotment, it should be split or flagged.
- **No Tasks**: Schedule should show empty slots or "Reflection/Planning" prompts.
- **Priority Conflict**: High priority tasks across different categories competing for morning slots.
