export function FieldError({
  id,
  errors,
}: {
  id: string;
  errors?: string[];
}) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-14 text-danger">
      {errors[0]}
    </p>
  );
}
