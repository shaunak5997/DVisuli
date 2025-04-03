# Application Specification

## Overview
This application serves as a basic tool to aggregate data from more than one source and then store and visualize important information in interactive charts.

**Note: I have noted down some important points/limitations in the last section**

## Stack
- **Backend**: FastAPI, SQLAlchemy, sqlite3
- **Frontend**: Javascript, Bootstrap, HTML, CSS

## Architecture and Workflow

### Abstractions
The basic abstractions of the application are as follows:
- **Task:** A task is the basic premise to use the visualization tool, a task requires:
  1. Task name (String)
  2. Task description (optional - String)
  3. At least 2 sources (we define the sources below)
- **Source:** A source is the basic building block of the application and it represents an external source from which the data is to be fetched. When the user clicks on Add Source, the user is prompted to upload a file (right now restricted to either JSON/CSV) along with some filters for the data contained in the file.
- Currently the restrictions allow the creation of tasks when at least two sources are added, but there is no upper limit on the number of sources a user can add.

##![DVisuli drawio](https://github.com/user-attachments/assets/3fc67257-7f50-4452-ba4b-23b2462916bf)
# Workflow



Let's understand the workflow:
- Once the user successfully creates a task and clicks on Generate Report button, a POST API call will be made to the backend comprising of the Task object shown below.
- The backend will parse the individual files uploaded by the user and will apply filters to the parsed data. **Note: I do not recommend applying filters to parsed data in memory, the data should be stored somewhere and then queried according to the filters OR the original data from external sources should be queried according to the filters. This operation is just created for the MVP/Demo purposes.**
- Once both the files are parsed and filters are applied, the data from both of them will be combined and will be stored in a sqlite database.
- Once a task is created, the user can visualize the task in the task history pane and can select any of them to show the analytics associated with the task.
- Once the user clicks on show analytics for a task, a GET API call along with taskName is made to the backend, after which the backend will fetch the task details and charts will be shown.

### Visualizations
Currently, I am showing two charts:
- A bar chart of total number of sales per car model.
  - Filter: There is a multi-select filter to select/un-select the car company
- A timeseries line chart of total number of sales per date
  - Filter: There is a filter to select a particular year/month for the data.

### API Spec
- **generateReport**:
  - TaskName
  - TaskDescription
  - List[Sources]
    - Source File
    - Filter
- **getAnalytics**:
  - Input:
    - taskName
  - Returns: Data for the graphs
- **getTasks** - fetches all the previous tasks.

### Security
- **UI**: I am using standard sanitization and validation before sending the data to the backend.
- **Backend**: I am doing input output sanitization at the backend, as well I have used slow API libraries to introduce rate limiting.

### Important Notes/Current Limitations
- **CHART Filters:** Currently I have just used two filters, but we can easily create dynamic filters like Azure/GCP uses, where you can also select which attribute you want to apply a filter on dynamically along with the values of that attribute. It would require more number of APIs which I have avoided for now.

- **Source Filters:** Right now I am using simple text based filters, because the exact data present in the external files is not known, hence I have avoided creating APIs to populate the filter dropdowns. The format of the filter is as follows - `price > 1000 < 5000, year > 2018 < 2022, company = Toyota`, this string is converted into a JSON while sending to the backend. In a real world application, a dynamic filter system can be envisaged in which the user can add a row of filter, which will have which attribute to apply the filter on, what operation to perform (include/exclude, range) followed by one or more values.

- **I have not used standard authentication + authorization techniques such as OAuth2 + JWT, which are more sophisticated ways/industry standards for security due to sheer time constraints, but these are quite straightforward to implement and should be present in a real world application**

- There can be many more optimizations, different table structures in the backend. I have not implemented all of them, but I know for sure how to implement them.
