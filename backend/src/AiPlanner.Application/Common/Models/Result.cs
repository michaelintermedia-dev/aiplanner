namespace AiPlanner.Application.Common.Models;

public class Result
{
    public bool Succeeded { get; }
    public IReadOnlyList<string> Errors { get; }

    protected Result(bool succeeded, IEnumerable<string> errors)
    {
        Succeeded = succeeded;
        Errors = errors.ToList();
    }

    public static Result Success() => new(true, Array.Empty<string>());
    public static Result Failure(params string[] errors) => new(false, errors);
}

public class Result<T> : Result
{
    public T? Value { get; }

    private Result(bool succeeded, T? value, IEnumerable<string> errors) : base(succeeded, errors)
    {
        Value = value;
    }

    public static Result<T> Success(T value) => new(true, value, Array.Empty<string>());
    public static new Result<T> Failure(params string[] errors) => new(false, default, errors);
}
