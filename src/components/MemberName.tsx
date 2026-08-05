import { nameParts } from "../lib/names";
import { useI18n } from "../i18n/LocaleContext";

type Props = {
  member: string;
  units?: string[];
  className?: string;
};

/** Stacked bilingual name: primary on top, secondary below. */
export function MemberName({ member, units, className = "" }: Props) {
  const { locale } = useI18n();
  const { primary, secondary } = nameParts(member, units, locale);
  return (
    <span className={`member-name ${className}`}>
      <span className="member-name-primary">{primary}</span>
      {secondary ? <span className="member-name-secondary">{secondary}</span> : null}
    </span>
  );
}
