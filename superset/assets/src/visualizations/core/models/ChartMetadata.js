export default class ChartMetadata {
  constructor({
    name,
    credits = [],
    description,
    thumbnail,
    show = true,
  }) {
    this.name = name;
    this.credits = credits;
    this.description = description;
    this.thumbnail = thumbnail;
    this.show = show;
  }
}
