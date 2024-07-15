# install-luau

A simple script that adds luau binaries to your path in a github workflow.

## Use Guide

Put this before your steps you want to use luau with:

```yml
- name: Install Luau
  uses: encodedvenom/install-luau@v1
```

It's that simple.

## A caveat

This workflow assumes you are using ubuntu in your workflows. This may change in the future.