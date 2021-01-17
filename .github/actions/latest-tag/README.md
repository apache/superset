# Latest tag

[![All Contributors](https://img.shields.io/github/all-contributors/EndBug/latest-tag)](#contributors-)

Automatically creates & updates a `latest` tag pointing to your latest release.

When using GitHub Actions you always have to put a reference for every action you use in your worflows: that means that you either need to choose a specific version or you need to use a branch.  
If you want to use the **latest** release of an action you can only hope authors are mantaining a `latest` tag that they update with every version: although not impossible, it's not that easy to find someone willing to do that.

That's why I made this action: if you're the kind of guy that doesn't like to update tags you can simply use this action and forget about it. You can just put `latest` in the documentation: your users will get the benefits of using a branch as ref and the security of using only stable versions (as long as you don't make breaking changes).

## Usage

Add a step like this to your workflow:

```yaml
- name: Run latest-tag
  uses: EndBug/latest-tag@latest
  with:
    # You can change the name of the tag with this input.
    # Default: 'latest'
    tag-name: someCustomTagName

    # If a description is provided, the action will use it to create an annotated tag. If none is given, the action will create a lightweight tag.
    # Optional
    description: Description for the tag
```

## License

This action is distributed under the MIT license, check the [license](LICENSE) for more info.

## Similar actions

[actions-tagger](https://github.com/marketplace/actions/actions-tagger): allows you to create and update both `latest` and major version tags, even though it doesn't support annotated tags and the major version tag is mandatory (ref v2.0.1).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/EndBug"><img src="https://avatars1.githubusercontent.com/u/26386270?v=4" width="100px;" alt=""/><br /><sub><b>Federico Grandi</b></sub></a><br /><a href="https://github.com/EndBug/latest-tag/commits?author=EndBug" title="Code">💻</a> <a href="https://github.com/EndBug/latest-tag/commits?author=EndBug" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/kslr"><img src="https://avatars3.githubusercontent.com/u/5516323?v=4" width="100px;" alt=""/><br /><sub><b>Kslr</b></sub></a><br /><a href="https://github.com/EndBug/latest-tag/commits?author=kslr" title="Code">💻</a></td>
    <td align="center"><a href="http://lukas.dolezalu.cz/"><img src="https://avatars0.githubusercontent.com/u/132277?v=4" width="100px;" alt=""/><br /><sub><b>Lukáš Doležal</b></sub></a><br /><a href="https://github.com/EndBug/latest-tag/commits?author=DocX" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ziyangczi"><img src="https://avatars0.githubusercontent.com/u/41968256?v=4" width="100px;" alt=""/><br /><sub><b>ziyangczi</b></sub></a><br /><a href="#ideas-ziyangczi" title="Ideas, Planning, & Feedback">🤔</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
