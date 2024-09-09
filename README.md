# Build Number Generator GitHub Action

This GitHub Action generates and increments build numbers based on a unique identifier. The build numbers are stored in
a JSON file within a specified branch of your repository, allowing you to track independent build numbers for different
projects or components.

## Features

- **Unique Build Numbers**: Generates unique build numbers for each identifier, ensuring different projects or components
  can maintain independent versioning.
- **Branch Customization**: Allows specifying the branch where the build numbers are stored.
- **Thread Safety**: Implements file locking to prevent race conditions when multiple instances of the action run concurrently.

## Inputs

- `token` (required): A GitHub token with write access to the repository.
- `branch` (optional): The branch where the build numbers are stored. Defaults to `build-numbers` if not specified.
- `identifier` (required): A unique identifier for the build number. Each identifier maintains its own sequence of build numbers.
- `increment` (optional): A boolean flag to control whether the build number should be incremented or just retrieved. Defaults to `true`.

## Outputs

- `build-number`: The newly generated build number for the specified identifier.

## Environment Variables

- `BUILD_NUMBER`: The newly generated build number is also set as an environment variable, making it easy to access in later steps.

## Usage Example

Here's an example of how to use the action in a workflow:

```yaml
name: Generate Build Number

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate Build Number
        uses: BetonQuest/build-number-generator@main
        id: generate
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          identifier: 'projectA'

      - name: Output Build Number (Output)
        run: |
          echo "Build Number: ${{ steps.generate.outputs.build-number }}"
      - name: Output Build Number (Environment)
        run: |
          echo "Build Number: ${{ env.BUILD_NUMBER }}"
```

Detailed Configuration:

````yaml
      - name: Generate Build Number
        uses: BetonQuest/build-number-generator@main
        id: generate
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          branch: 'build-numbers' 
          identifier: 'projectA'
          increment: true
````

## Detailed Explanation
### 1. File Locking for Concurrency
This action uses `proper-lockfile` to ensure that the `build_numbers.json` file is not accessed by multiple processes
simultaneously.
This prevents race conditions when the action runs concurrently.

### 2. Branch Handling
The action checks out the specified branch (and `build-numbers` by default).
If the branch does not exist, it is created and set to track the remote branch.

### 3. JSON File Structure
The `build_numbers.json` file is structured as follows:

```json
{
  "identifier1": 123,
  "identifier2": 45,
  "projectA": 10
}
```

Each key corresponds to an identifier, and the value is the current build number.

## Considerations
   
- **GitHub Token**: Ensure that the GitHub token used has sufficient permissions to push to the specified branch.
- **File Locking**: The file locking mechanism is critical for ensuring that build numbers are not corrupted by concurrent writes.

## Contributing
   
Feel free to open issues or submit pull requests for improvements and bug fixes.

## License

This project is licensed under the GPL3 License. See the [LICENSE](/LICENSE) file for details.
