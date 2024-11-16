# install-luau

A simple script that adds luau binaries to your path in a github workflow.

Now available on the [GitHub Marketplace!](https://github.com/marketplace/actions/install-luau)

## Use Guide

Put this before your steps you want to use luau with:

```yml
- name: Install Luau
  uses: encodedvenom/install-luau@v4.2
```

It's that simple.

Once you have this done, you can use it in your CI scripts. Here's an example from [Jecs's](https://github.com/Ukendio/jecs) CI script:

```yml
- name: Run Unit Tests
  id: run_tests
  run: |
    output=$(luau test/tests.luau)
    echo "$output"
    if [[ "$output" == *"0 fails"* ]]; then
      echo "Unit Tests Passed"
    else
      echo "Error: One or More Unit Tests Failed."
      exit 1
    fi
```

## Runners Supported

This project officially supports `windows-latest` and `ubuntu-latest`. For unknown reasons, the macOS runner will not play nice, and therefore should not be used alongside this action.
